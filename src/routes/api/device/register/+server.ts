//SSE Connection passing in Factory JWT Token and Generated PIN
//Verify JWT Token and PIN format and strength
//Create a UUID for the device
//Store a PIN to Device UUID mapping using DeviceManager (transient)
//Create a subscription for the device 
//Create subscription:device:uuid to subscriber:connection:uuid   
//If SSE disconnected, remove this subscription and PIN_UUID mappings
//Wait for User to Claim Device
//When User claims device, update DeviceManager with User ID
//Send message to subscription:device:uuid to subscriber:user:userId to notify device that is claimed
//Message contains userInfo, api_key, and the device_id
//On Received, Device will store this information in a secure location

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { checkPinFormat } from '$lib/server/device/devicePinChecker';
import type { DeviceMeta } from '$lib/server/device/deviceMeta';
import { ClaimStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { DeviceManager } from '$lib/server/device/deviceManager';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { DeviceStatusManager } from '$lib/server/device/deviceStatusManager';
import { 
    ResponseStatus,
    ResponseCategory,
    createErrorResponse,
    toResponse
} from '$lib/shared/response_format';
import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';
import { checkDevicePreclaim } from '$lib/server/device/devicePreclaim';
import { sendDeviceRegistrationMessage, createClaimOptions } from '$lib/server/device/deviceRegistrationUtils';

////Device
//Device will then disconnect which cases the subscription to disappear
//Device will call device/registered to information that user has been successful reigstered including os, model, and other device information
//RoutingMessage will be sent to scope: "user:userId" to inform of device e.g. all connection belonging to user will receive this message
//Device will then connect to device/listen with the API Key

/**
 * Device registration endpoint using SSE for real-time communication
 * Handles PIN validation and device registration
 */
export const GET: RequestHandler = async ({ locals, request }: any) => {
    try {
        // Verify Factory JWT (signature, audience, typ, scope)
        await verifyFactoryJWT(locals, request);

        // Validate the PIN
        const pin = request.headers.get('X-Device-PIN');
        const mac = request.headers.get('X-Device-MAC');

        logger.debug(`X-Device-MAC: ${mac}`);

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
                logger.warn(`Device with MAC ${mac} is already claimed`);
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
        
        // Store the PIN in locals so it can be accessed in the stream
        locals.pin = pin;
        locals.deviceId = deviceId;
        
        // Create SSE stream
        const stream = new ReadableStream({
            start(controller) {
                // Create connection metadata
                const connectionMeta = {
                    id: deviceId,
                    userInfo: {
                        id: 'admin-device',
                        email: 'admin@admin.com',
                        name: 'Admin User',
                        systemRole: 'ADMIN',
                        source: 'session' as const
                    },
                    nodeId: 'device-register',
                    protocol: 'sse',
                    deviceId: deviceId,
                    connectedAt: Date.now()
                };

                // Create SSE connection
                const connection = new SSEConnection(connectionMeta, controller);
                ConnectionManager.registerConnection(connection);

                logger.debug(`Device registration SSE connection established: ${deviceId}`);

                // Create device metadata with the connection ID and MAC address
                const mac = (locals as any).deviceMac as string | null;
                const deviceMeta: DeviceMeta = {
                    id: deviceId,
                    connectionId: deviceId,
                    macAddress: mac || undefined,
                    wifiMac: mac || undefined,
                };
                
                // Register the device with the PIN
                (async () => {
                    await DeviceManager.registerDevice(pin, deviceMeta);
                    // Handle preclaimed devices
                    const preclaim = (locals as any).preclaimDevice;
                    if (preclaim) {
                        logger.info(`Processing preclaim for device ${deviceId} with preclaim ${preclaim.preclaim.id}`);
                        
                        // Use preclaim set creator as the claiming user (fallback if claimedBy is not set)
                        let resolvedClaimUserId: string | null = null;
                        
                        locals.prisma.preclaimSet.findUnique({
                            where: { id: preclaim.preclaim.setId },
                            select: { createdBy: true }
                        }).then((preclaimSet: any) => {
                            resolvedClaimUserId = preclaim.preclaim.claimedBy || preclaimSet?.createdBy;
                            
                            if (!resolvedClaimUserId) {
                                logger.error(`No user found to claim preclaimed device ${deviceId}`);
                                return;
                            }
                            
                            // Immediately claim the device with preclaim info
                            return DeviceManager.claimDevice(pin, {
                                userId: resolvedClaimUserId,
                                accountId: preclaim.preclaim.accountId,
                                preclaimId: preclaim.preclaim.id
                            });
                        }).then(async (claimedDevice: any) => {
                            if (!claimedDevice) {
                                logger.error(`Failed to claim device ${deviceId} after preclaim processing`);
                                return;
                            }

                            // Update device network identifiers using the provided MAC
                            const mac = (locals as any).deviceMac as string | null;
                            if (mac) {
                                await locals.prisma.device.update({
                                    where: { id: claimedDevice.id },
                                    data: {
                                        macAddress: mac,
                                        wifiMac: mac
                                    }
                                });
                            }

                            // Get the actual API key from the claimed device
                            const deviceWithApiKey = await locals.prisma.device.findUnique({
                                where: { id: claimedDevice.id },
                                select: { apiKey: true }
                            });

                            if (!deviceWithApiKey?.apiKey) {
                                logger.error(`No API key found for claimed device ${deviceId}`);
                                return;
                            }

                            // Update preclaim record with claim metadata and linkage to device
                            const preclaim = (locals as any).preclaimDevice;
                            await locals.prisma.preclaimDevice.update({
                                where: { id: preclaim.preclaim.id },
                                data: {
                                    status: ClaimStatus.FULFILLED,
                                    claimedAt: new Date(),
                                    claimedBy: resolvedClaimUserId, // Use the resolved claimUserId
                                    deviceId: deviceId
                                }
                            });

                            // Send registration message using shared utility with the actual API key
                            return sendDeviceRegistrationMessage(deviceId, {
                                id: deviceId,
                                apiKey: deviceWithApiKey.apiKey, // Use the actual API key from the claimed device
                                accountId: preclaim.preclaim.accountId,
                                claimedBy: resolvedClaimUserId, // Use the resolved claimUserId instead of preclaim.preclaim.claimedBy
                                name: 'Preclaimed Device',
                                deviceType: 'UNKNOWN',
                                status: 'ACTIVE'
                            });
                        }).catch((error: any) => {
                            logger.error(`Error in preclaim processing: ${error}`);
                        });
                    }
                    
                    logger.info(`Device ${deviceId} registered with PIN ${pin}`);
                })().catch((error: any) => {
                    logger.error(`Error registering device: ${error}`);
                });

                // Auto-subscribe device to its own scope for receiving commands
                subscriptionRegistry.addSubscription(
                    `subscription:device:${deviceId}`,
                    `subscriber:connection:${deviceId}`
                ).then(() => {
                    logger.info(`Device ${deviceId} auto-subscribed to its own channel`);
                }).catch((error: any) => {
                    logger.error(`Failed to auto-subscribe device ${deviceId}: ${error}`);
                });

                // Send initial message
                controller.enqueue(new TextEncoder().encode(
                    `data: ${JSON.stringify({
                        type: 'registered',
                        deviceId: deviceId,
                        message: 'Device registered successfully, waiting for claim'
                    })}\n\n`
                ));
            },
            cancel() {
                // Clean up device subscription when connection closes
                const deviceId = (locals as any).deviceId;
                if (deviceId) {
                    subscriptionRegistry.removeSubscription(
                        `subscription:device:${deviceId}`,
                        `subscriber:connection:${deviceId}`
                    ).then(() => {
                        logger.debug(`Device ${deviceId} subscription cleaned up`);
                    }).catch((error: any) => {
                        logger.warn(`Failed to clean up device ${deviceId} subscription: ${error}`);
                    });
                }
                
                logger.debug(`Device registration SSE connection closed`);
            }
        });

        // Return SSE response
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
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
