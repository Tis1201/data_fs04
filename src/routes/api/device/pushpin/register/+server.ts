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
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';
import { SSEConnection } from '$lib/server/messaging/connections/sse_connection';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { sendDeviceRegistrationMessage } from '$lib/server/device/deviceRegistrationUtils';
import { checkDevicePreclaim } from '$lib/server/device/devicePreclaim';
import { ClaimStatus } from '@prisma/client';

/**
 * Pushpin device registration endpoint with persistent connection (like SSE).
 * Creates a persistent SSE stream that stays open to receive claim notifications.
 */
export const GET: RequestHandler = async ({ locals, request }) => {
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
        const preclaimDevice = await checkDevicePreclaim(locals, request);
        if (preclaimDevice?.preclaim) {
            logger.info(`Found preclaimed device for MAC ${mac}`);
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
        
        // CRITICAL FIX: Use a separate temporary connection ID for the registration SSE stream
        // to prevent it from overwriting the permanent listen endpoint connection
        const tempRegistrationConnectionId = `temp-register-${deviceId}`;

        const deviceMeta: DeviceMeta = {
            id: deviceId,
            connectionId: deviceId, // Use deviceId as connectionId for Pushpin
            macAddress: mac || undefined,
            wifiMac: mac || undefined
        };

        // Create SSE stream
        const stream = new ReadableStream({
            start(controller) {
                // Create connection metadata with temporary connection ID
                const connectionMeta: ConnectionMeta = {
                    id: tempRegistrationConnectionId, // Use temporary ID to avoid collision
                    deviceId: deviceId, // Keep deviceId reference
                    userInfo: {
                        id: 'system',
                        email: 'system@system.com',
                        name: 'System',
                        systemRole: 'ADMIN',
                        source: 'apiKey'
                    },
                    nodeId: 'device-pushpin-register',
                    protocol: 'pushpin',
                    connectedAt: Date.now()
                };

                // Create SSE connection
                const connection = new SSEConnection(connectionMeta, controller);
                ConnectionManager.registerConnection(connection);

                logger.info(`Pushpin device registration SSE connection established: ${deviceId} (temp connection ID: ${tempRegistrationConnectionId})`);

                // Register the device with the PIN
                (async () => {
                    await DeviceManager.registerDevice(pin, deviceMeta);
                    
                    // Handle preclaimed devices (same as SSE endpoint)
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
                            
                            // Immediately claim the device with preclaim info (same as SSE)
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
                // Use temporary connection ID for the registration phase
                subscriptionRegistry.addSubscription(
                    `subscription:device:${deviceId}`,
                    `subscriber:connection:${tempRegistrationConnectionId}`
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
                // DON'T clean up device subscription when registration connection closes
                // The subscription will be managed by the listen endpoint
                // Only log the connection closure
                const deviceId = (locals as any).deviceId;
                logger.info(`Pushpin device registration connection closed: ${deviceId} (temp connection ID: ${tempRegistrationConnectionId})`);
                logger.debug(`[Pushpin] Registration stream cleanup - subscription will be managed by listen endpoint`);
            }
        });

        // Return SSE response with Pushpin GRIP headers
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
                'Access-Control-Allow-Origin': '*',
                // Pushpin GRIP headers for long-lived connections
                // Cloudflare-compatible: shorter keep-alive interval (15s) for proxy compatibility
                'Grip-Hold': 'stream',
                'Grip-Channel': `device:${deviceId}`,
                'Grip-Keep-Alive': ':\\n\\n; format=cstring; timeout=15'
            }
        });
    } catch (error: any) {
        if (error instanceof Response) {
            return error;
        }

        logger.error(`Error in pushpin register: ${error}`);
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
