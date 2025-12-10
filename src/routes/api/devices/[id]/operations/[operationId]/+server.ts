import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params } = event;
        const auth = event.auth;

        if (!auth?.user) {
            return json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentication required',
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 401 });
        }
        const { id: deviceId, operationId } = params;
        
        if (!deviceId || !operationId) {
            return json({ 
                success: false, 
                error: { 
                    code: 'INVALID_REQUEST', 
                    message: 'Device ID and Operation ID are required',
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
            if (auth.user.systemRole !== SystemRole.ADMIN && device.user.id !== auth.user.id) {
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

            // Get operation details
            const operation = await prisma.deviceActionLog.findFirst({
                where: { 
                    id: operationId,
                    deviceId 
                },
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
                    requestId: true,
                    connectionId: true,
                    protocol: true
                }
            });

            if (!operation) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'OPERATION_NOT_FOUND', 
                        message: 'Operation not found',
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 404 });
            }

            // Calculate duration if completed
            let duration = null;
            if (operation.completedAt && operation.initiatedAt) {
                duration = new Date(operation.completedAt).getTime() - new Date(operation.initiatedAt).getTime();
            }

            logger.info(`[OperationStatusAPI] Operation status retrieved for device ${deviceId}, operation ${operationId} by user ${auth.user.email}`);

            return json({
                success: true,
                data: {
                    operation: {
                        id: operation.id,
                        actionType: operation.actionType,
                        status: operation.status,
                        initiatedAt: operation.initiatedAt,
                        completedAt: operation.completedAt,
                        message: operation.message,
                        progress: operation.progress,
                        metadata: operation.metadata,
                        initiatedBy: operation.initiatedBy,
                        requestId: operation.requestId,
                        connectionId: operation.connectionId,
                        protocol: operation.protocol,
                        duration: duration ? Math.floor(duration / 1000) : null // Duration in seconds
                    },
                    deviceId,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            logger.error(`[OperationStatusAPI] Error retrieving operation status: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to retrieve operation status',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
