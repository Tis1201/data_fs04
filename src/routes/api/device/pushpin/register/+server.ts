import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';
import { checkPinFormat } from '$lib/server/device/devicePinChecker';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { logger } from '$lib/server/logger';
import type { RequestHandler } from './$types';
import type { DeviceMeta } from '$lib/server/device/deviceMeta';
import { v4 as uuidv4 } from 'uuid';
import {
    createErrorResponse,
    ResponseCategory,
    ResponseStatus,
    toResponse
} from '$lib/shared/response_format';
// import { getMessageRelay } from '$lib/server/pushpin/middleware'; // TODO: Re-enable when pushpin middleware is implemented
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { checkDevicePreclaim } from '$lib/server/device/devicePreclaim';
import { ClaimStatus } from '@prisma/client';

/**
 * Pushpin device registration endpoint (stateless).
 *
 * ARCHITECTURE:
 * - Device connects to Pushpin (not backend directly)
 * - Backend returns GRIP headers immediately (stateless)
 * - Pushpin holds the connection
 * - When device is claimed, backend publishes via Pushpin Control Port
 * - No ReadableStream, no SSEConnection, no ConnectionManager
 *
 * FLOW:
 * 1. Device → Pushpin → Backend (validate, return GRIP headers)
 * 2. Backend → immediately returns (stateless)
 * 3. Pushpin holds device connection
 * 4. User claims device
 * 5. Backend → Pushpin Control Port → Pushpin → Device
 */
export const GET: RequestHandler = async ({ locals, request }) => {
    try {
        // Verify Factory JWT (signature, audience, typ, scope)
        await verifyFactoryJWT(locals, request);

        // Validate the PIN
        const pin = request.headers.get('X-Device-PIN');
        const mac = request.headers.get('X-Device-MAC');

        logger.debug(`[Register] X-Device-MAC: ${mac}`);

        // Stash MAC for later use during connection
        (locals as any).deviceMac = mac;

        // Check if device is already claimed before by matching device "macAddress" with "X-Device-MAC"
        if (mac) {
            const existingDevice = await locals.prisma.device.findFirst({
                where: {
                    OR: [
                        { macAddress: mac },
                        { wifiMac: mac }
                    ]
                }
            });

            if (existingDevice?.claimedBy) {
                logger.warn(`[Register] Device with MAC ${mac} is already claimed`);
                throw toResponse(createErrorResponse({
                    error: 'ValidationError',
                    message: 'Device is already claimed',
                    status: ResponseStatus.BAD_REQUEST,
                    category: ResponseCategory.DEVICE
                }));
            }
        }

        // Check preclaim (active, unclaimed, not expired) for this MAC
        const preclaimDevice = await checkDevicePreclaim(locals, request);
        if (preclaimDevice?.preclaim) {
            logger.info(`[Register] Found preclaimed device for MAC ${mac}`);
            (locals as any).preclaimDevice = preclaimDevice;
        }

        // Validate PIN format
        if (!pin || !checkPinFormat(pin)) {
            throw toResponse(createErrorResponse({
                error: 'ValidationError',
                message: 'Invalid PIN format',
                status: ResponseStatus.BAD_REQUEST,
                category: ResponseCategory.DEVICE
            }));
        }

        // Create device identity for this registration
        const deviceId = uuidv4();
        const channel = `device:${deviceId}`;

        const deviceMeta: DeviceMeta = {
            id: deviceId,
            connectionId: deviceId, // Use deviceId as connectionId (no temp connection!)
            macAddress: mac || undefined,
            wifiMac: mac || undefined
        };

        logger.info(`[Register] Device ${deviceId} registering with PIN ${pin}`);

        // Add subscription for this device
        // Note: Uses deviceId directly (no temp-register-{deviceId})
        // This is idempotent - can be called multiple times safely
        try {
            await subscriptionRegistry.addSubscription(
                `subscription:device:${deviceId}`,
                `subscriber:connection:${deviceId}`
            );
            logger.info(`[Register] Added subscription for device ${deviceId}`);
        } catch (error) {
            logger.warn(`[Register] Failed to add subscription (non-fatal): ${error}`);
        }

        // Register the device with PIN (asynchronously - don't block GRIP response)
        // This needs to happen AFTER we return, so device can receive messages
        setTimeout(async () => {
            try {
                await DeviceManager.registerDevice(pin, deviceMeta);
                logger.info(`[Register] Device ${deviceId} registered in DeviceManager`);

                // Handle preclaimed devices (auto-claim)
                const preclaim = (locals as any).preclaimDevice;
                if (preclaim) {
                    logger.info(`[Register] Processing preclaim for device ${deviceId}`);

                    // Get the claiming user (from preclaim or set creator)
                    let resolvedClaimUserId: string | null = preclaim.preclaim.claimedBy;

                    if (!resolvedClaimUserId) {
                        const preclaimSet = await locals.prisma.preclaimSet.findUnique({
                            where: { id: preclaim.preclaim.setId },
                            select: { createdBy: true }
                        });
                        resolvedClaimUserId = preclaimSet?.createdBy || null;
                    }

                    if (!resolvedClaimUserId) {
                        logger.error(`[Register] No user found to claim preclaimed device ${deviceId}`);
                        return;
                    }

                    // Claim the device
                    const claimedDevice = await DeviceManager.claimDevice(pin, {
                        userId: resolvedClaimUserId,
                        accountId: preclaim.preclaim.accountId,
                        preclaimId: preclaim.preclaim.id
                    });

                    if (!claimedDevice) {
                        logger.error(`[Register] Failed to claim device ${deviceId} after preclaim`);
                        return;
                    }

                    logger.info(`[Register] Device ${deviceId} claimed successfully`);

                    // Update device network identifiers using the provided MAC
                    if (mac) {
                        await locals.prisma.device.update({
                            where: { id: claimedDevice.id },
                            data: {
                                macAddress: mac,
                                wifiMac: mac
                            }
                        });
                        logger.info(`[Register] Updated MAC address for device ${deviceId}`);
                    }

                    // Get the actual API key from the claimed device
                    const deviceWithApiKey = await locals.prisma.device.findUnique({
                        where: { id: claimedDevice.id },
                        select: { apiKey: true }
                    });

                    if (!deviceWithApiKey?.apiKey) {
                        logger.error(`[Register] No API key found for claimed device ${deviceId}`);
                        return;
                    }

                    // Update preclaim record
                    await locals.prisma.preclaimDevice.update({
                        where: { id: preclaim.preclaim.id },
                        data: {
                            status: ClaimStatus.FULFILLED,
                            claimedAt: new Date(),
                            claimedBy: resolvedClaimUserId,
                            deviceId: deviceId
                        }
                    });
                    logger.info(`[Register] Updated preclaim record for device ${deviceId}`);

                    // TODO: Re-enable when pushpin middleware is implemented
                    // Publish "registered" message via Redis Pub/Sub (sidecars relay to Pushpin)
                    /*
                    const messageRelay = getMessageRelay();
                    if (!messageRelay) {
                        logger.error(`[Register] MessageRelay not initialized - cannot publish registration message for device ${deviceId}`);
                    } else {
                        await messageRelay.publishToChannel(channel, {
                            type: 'device',
                            payload: {
                                action: 'registered',
                                id: deviceId,
                                apiKey: deviceWithApiKey.apiKey,
                                accountId: preclaim.preclaim.accountId,
                                userId: resolvedClaimUserId,
                                name: 'Preclaimed Device',
                                deviceType: 'UNKNOWN',
                                status: 'ACTIVE'
                            },
                            timestamp: new Date().toISOString()
                        });

                        logger.info(`[Register] Published registration message for device ${deviceId} via Redis Pub/Sub`);
                    }
                    */
                    logger.info(`[Register] Skipping pushpin message relay (not implemented yet) for device ${deviceId}`);
                }
            } catch (error) {
                logger.error(`[Register] Error in background registration: ${error}`);
            }
        }, 100); // Small delay to ensure Pushpin connection is established

        // Return GRIP headers immediately - Pushpin will hold the connection
        // NO ReadableStream, NO SSEConnection, NO ConnectionManager = STATELESS!
        logger.info(`[Register] Returning GRIP response for device ${deviceId}`);
        
        return new Response('', {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'Access-Control-Allow-Origin': '*',
                // Pushpin GRIP headers for long-lived connections
                'Grip-Hold': 'stream',
                'Grip-Channel': channel,
                'Grip-Keep-Alive': ':\\n\\n; format=cstring; timeout=15'
            }
        });
        
    } catch (error: any) {
        if (error instanceof Response) {
            return error;
        }

        logger.error(`[Register] Error in pushpin register: ${error}`);
        return new Response(JSON.stringify({
            status: ResponseStatus.SERVER_ERROR,
            error: 'InternalServerError',
            message: 'An error occurred during registration'
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
};
