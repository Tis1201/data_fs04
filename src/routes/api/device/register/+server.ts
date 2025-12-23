//Device registration endpoint - devices now use MQTT for communication
//Verify JWT Token and PIN format and strength
//Create a UUID for the device
//Store a PIN to Device UUID mapping using DeviceManager (transient)
//Wait for User to Claim Device via MQTT claim flow

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { checkPinFormat } from '$lib/server/device/devicePinChecker';
import type { DeviceMeta } from '$lib/server/device/deviceMeta';
import { ClaimStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { 
    ResponseStatus,
    ResponseCategory,
    createErrorResponse,
    toResponse
} from '$lib/shared/response_format';
import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';
import { checkDevicePreclaim } from '$lib/server/device/devicePreclaim';
import { PreclaimProfileService } from '$lib/server/device/profile';
import { getClientIp } from '$lib/utils/request-utils';

////Device
//Device will then disconnect which cases the subscription to disappear
//Device will call device/registered to information that user has been successful reigstered including os, model, and other device information
//RoutingMessage will be sent to scope: "user:userId" to inform of device e.g. all connection belonging to user will receive this message
//Device will then connect to device/listen with the API Key

/**
 * Device registration endpoint
 * Handles PIN validation and device registration
 * Devices now use MQTT for communication after registration
 */
export const GET: RequestHandler = async (event) => {
    const { locals, request } = event;
    try {
        // Verify Factory JWT (signature, audience, typ, scope) and get token string
        const { claims, token: factoryTokenString } = await verifyFactoryJWT(locals, request);

        // Get client IP address
        const clientIp = getClientIp(event);

        // Update FactoryToken record to mark it as used
        try {
            const factoryToken = await locals.prisma.factoryToken.findFirst({
                where: { 
                    token: factoryTokenString,
                    isUsed: false,
                    expiresAt: { gt: new Date() }
                }
            });

            if (factoryToken) {
                await locals.prisma.factoryToken.update({
                    where: { id: factoryToken.id },
                    data: {
                        isUsed: true,
                        usedAt: new Date(),
                        usedByIp: clientIp
                    }
                });
                logger.info(`Factory token ${factoryToken.id} marked as used from IP ${clientIp || 'unknown'}`);
            } else {
                // Token not found or already used - log warning but continue with registration
                logger.warn(`Factory token not found or already used: token=${factoryTokenString.substring(0, 20)}..., jti=${claims.jti || 'unknown'}`);
            }
        } catch (error) {
            // Log error but don't fail registration
            logger.error(`Failed to update FactoryToken: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Validate the PIN
        const pin = request.headers.get('X-Device-PIN');
        const deviceMac = request.headers.get('X-Device-MAC');

        logger.debug(`X-Device-MAC: ${deviceMac}`);

        // Stash MAC for later use during connection
        (locals as any).deviceMac = deviceMac;

        // Check if device is already claimed before by matching device "macAddress" with "X-Device-MAC"
        if (deviceMac) {
            const existingDevice = await locals.prisma.device.findFirst({
                where: { 
                    OR: [
                        { macAddress: deviceMac },
                        { wifiMac: deviceMac }
                    ]
                }
            });
            
            if (existingDevice?.claimedBy) {
                logger.warn(`Device with MAC ${deviceMac} is already claimed`);
                throw toResponse(createErrorResponse({
                    error: 'ValidationError',
                    message: 'Device is already claimed',
                    status: ResponseStatus.BAD_REQUEST,
                    category: ResponseCategory.DEVICE
                }));
            }
        }

        // Check preclaim (active, unclaimed, not expired) for this MAC
        try {
            const preclaimCheck = await checkDevicePreclaim(locals, request);
            if (preclaimCheck?.preclaim) {
                // Stash for later use in flow (e.g., shortcut pin registration)
                (locals as any).preclaimDevice = preclaimCheck;
                logger.info(`Preclaim found for MAC ${preclaimCheck.mac}, preclaimId=${preclaimCheck.preclaim.id}`);
            }
        } catch (e) {
            logger.error(`Preclaim check error: ${e}`);
        }
        
        if (!pin) {
            logger.warn('No PIN provided');
            throw toResponse(createErrorResponse({
                error: 'ValidationError',
                message: 'No PIN provided',
                status: ResponseStatus.BAD_REQUEST,
                category: ResponseCategory.DEVICE
            }));
        }
        
        if (!checkPinFormat(pin)) {
            logger.warn('Invalid PIN format');
            throw toResponse(createErrorResponse({
                error: 'ValidationError',
                message: 'Invalid PIN format',
                status: ResponseStatus.BAD_REQUEST,
                category: ResponseCategory.DEVICE
            }));
        }
        
        logger.debug(`PIN: ${pin}`);
        
        // Generate a new device ID
        const deviceId = uuidv4();
        
        // Create device metadata with MAC address
        const deviceMeta: DeviceMeta = {
            id: deviceId,
            connectionId: deviceId,
            macAddress: deviceMac || undefined,
            wifiMac: deviceMac || undefined,
        };
        
        // Register the device with the PIN
        await DeviceManager.registerDevice(pin, deviceMeta);
        
        // Handle preclaimed devices
        const preclaim = (locals as any).preclaimDevice;
        if (preclaim) {
            logger.info(`Processing preclaim for device ${deviceId} with preclaim ${preclaim.preclaim.id}`);
            
            // Use preclaim set creator as the claiming user (fallback if claimedBy is not set)
            const preclaimSet = await locals.prisma.preclaimSet.findUnique({
                where: { id: preclaim.preclaim.setId },
                select: { createdBy: true }
            });
            
            const resolvedClaimUserId = preclaim.preclaim.claimedBy || preclaimSet?.createdBy;
            
            if (!resolvedClaimUserId) {
                logger.error(`No user found to claim preclaimed device ${deviceId}`);
                return json({
                    success: false,
                    error: 'No user found to claim preclaimed device',
                    deviceId
                }, { status: 500 });
            }
            
            // Immediately claim the device with preclaim info
            const claimedDevice = await DeviceManager.claimDevice(pin, {
                userId: resolvedClaimUserId,
                accountId: preclaim.preclaim.accountId,
                preclaimId: preclaim.preclaim.id
            });
            
            if (!claimedDevice) {
                logger.error(`Failed to claim device ${deviceId} after preclaim processing`);
                return json({
                    success: false,
                    error: 'Failed to claim device',
                    deviceId
                }, { status: 500 });
            }

            // Update device network identifiers using the provided MAC
            if (deviceMac) {
                await locals.prisma.device.update({
                    where: { id: claimedDevice.id },
                    data: {
                        macAddress: deviceMac,
                        wifiMac: deviceMac
                    }
                });
            }

            // Update preclaim record with claim metadata and linkage to device
            await locals.prisma.preclaimDevice.update({
                where: { id: preclaim.preclaim.id },
                data: {
                    status: ClaimStatus.FULFILLED,
                    claimedAt: new Date(),
                    claimedBy: resolvedClaimUserId,
                    deviceId: deviceId
                }
            });

            // Apply device profile if assigned to preclaim set
            if (resolvedClaimUserId) {
                try {
                    const profileService = new PreclaimProfileService(locals.prisma);
                    await profileService.applyToDevice(
                        deviceId,
                        preclaim.preclaim.setId,
                        resolvedClaimUserId
                    );
                } catch (profileError: any) {
                    logger.error(`Failed to apply profile to claimed device ${deviceId}:`, profileError);
                    // Don't fail the claim if profile application fails
                }
            }

            logger.info(`Device ${deviceId} registered and claimed via preclaim`);
            
            return json({
                success: true,
                deviceId: deviceId,
                message: 'Device registered and claimed successfully',
                claimed: true
            });
        }
        
        logger.info(`Device ${deviceId} registered with PIN ${pin}`);
        
        return json({
            success: true,
            deviceId: deviceId,
            message: 'Device registered successfully, waiting for claim via MQTT',
            claimed: false
        });
        
    } catch (error) {
        logger.error(`Error in device registration: ${error}`);
        
        if (error instanceof Response) {
            return error;
        }
        
        // Create a standardized error response
        const errorResponse = createErrorResponse({
            error: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
            status: ResponseStatus.SERVER_ERROR,
            category: ResponseCategory.DEVICE,
            details: `Error establishing device registration: ${error}`
        });
        
        return toResponse(errorResponse);
    }
};
