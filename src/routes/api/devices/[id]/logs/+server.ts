import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { publisher } from '$lib/server/messaging/core/publisher';
import { SystemUser } from '$lib/server/messaging/interfaces/message';

export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, url } = event;
        const deviceId = params.id;
        const format = url.searchParams.get('format') || 'json';
        const limit = parseInt(url.searchParams.get('limit') || '100');

        if (!event.auth?.user) {
            return json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
        }

        const user = event.auth.user;
        
        if (!deviceId) {
            return json({ 
                success: false, 
                error: { 
                    code: 'INVALID_REQUEST', 
                    message: 'Device ID is required',
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 400 });
        }

        try {
            // Verify device exists and user has access
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                select: { 
                    id: true, 
                    name: true, 
                    connected: true, 
                    status: true,
                    user: { select: { id: true } }
                }
            });

            if (!device) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'DEVICE_NOT_FOUND', 
                        message: 'Device not found',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 404 });
            }

            // Check if user has access to this device
            if (user.systemRole !== SystemRole.ADMIN && device.user.id !== user.id) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'FORBIDDEN', 
                        message: 'Access denied to this device',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 403 });
            }

            if (!device.connected) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'DEVICE_OFFLINE', 
                        message: 'Device is offline',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 400 });
            }

            // If format is zip, request logs from device
            if (format === 'zip') {
                const requestId = crypto.randomUUID();
                
                // Create action log entry
                const created = await ActionLogger.createInitiated({
                    deviceId,
                    actionType: 'logs',
                    initiatedBy: user.id,
                    requestId,
                    connectionId: 'api',
                    protocol: 'api',
                    metadata: {
                        format: 'zip',
                        requestedBy: user.email
                    },
                    initialMessage: 'Requesting logs from device'
                });

                // Send get logs command to device via SSE
                const routingMessage = MessageFactory.createSystemMessage(
                    'device:getLogs',
                    `subscription:device:${deviceId}`,
                    {
                        action: 'getLogs',
                        deviceId,
                        format: 'zip',
                        logId: created.id,
                        requestId
                    },
                    SystemUser,
                    { echoToSender: false }
                );

                await publisher.publish(routingMessage);

                // Set up timeout (30 seconds for log retrieval)
                setTimeout(async () => {
                    try {
                        const current = await prisma.deviceActionLog.findUnique({ 
                            where: { id: created.id }, 
                            select: { status: true } 
                        });
                        if (!current) return;
                        
                        if (current.status === 'initiated' || current.status === 'in_progress') {
                            await ActionLogger.finalize(created.id, 'failed', 'Log retrieval timed out after 30 seconds');
                        }
                    } catch (timeoutErr) {
                        logger.warn(`[LogsAPI] Failed to process log retrieval timeout for ${created.id}: ${String(timeoutErr)}`);
                    }
                }, 30 * 1000); // 30 seconds

                logger.info(`[LogsAPI] Log retrieval initiated for device ${deviceId} by user ${user.email}`);

                return json({
                    success: true,
                    data: {
                        operationId: created.id,
                        deviceId,
                        action: 'get_logs',
                        status: 'initiated',
                        message: 'Log retrieval initiated',
                        format: 'zip',
                        timestamp: new Date().toISOString(),
                        requestId
                    }
                });
            }

            // For JSON format, return recent action logs
            const logs = await prisma.deviceActionLog.findMany({
                where: { deviceId },
                orderBy: { initiatedAt: 'desc' },
                take: Math.min(limit, 1000), // Cap at 1000
                select: {
                    id: true,
                    actionType: true,
                    status: true,
                    initiatedAt: true,
                    completedAt: true,
                    message: true,
                    progress: true,
                    metadata: true,
                    initiatedBy: true,
                    requestId: true
                }
            });

            logger.info(`[LogsAPI] Logs retrieved for device ${deviceId} by user ${user.email}`);

            return json({
                success: true,
                data: {
                    deviceId,
                    logs,
                    total: logs.length,
                    format: 'json',
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error(`[LogsAPI] Error handling logs request: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to retrieve logs',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
