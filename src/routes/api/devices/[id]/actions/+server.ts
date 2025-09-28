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

// Define action types and their configurations (NEW UNIFIED FLOW)
const ACTION_CONFIGS = {
    reboot: {
        actionType: 'reboot',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 2 * 60 * 1000, // 2 minutes
        requiredFields: []
    },
    restart: {
        actionType: 'restart',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 1 * 60 * 1000, // 1 minute
        requiredFields: []
    },
    installApp: {
        actionType: 'install_app',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 10 * 60 * 1000, // 10 minutes
        requiredFields: ['packageName']
    },
    pushFile: {
        actionType: 'push_file',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 15 * 60 * 1000, // 15 minutes
        requiredFields: ['sourcePath', 'destinationPath']
    },
    pullFile: {
        actionType: 'pull_file',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 10 * 60 * 1000, // 10 minutes
        requiredFields: ['sourcePath', 'destinationPath']
    },
    updateFirmware: {
        actionType: 'update_firmware',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 30 * 60 * 1000, // 30 minutes
        requiredFields: ['firmwareVersion']
    },
    getLogs: {
        actionType: 'get_logs',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 10 * 60 * 1000, // 10 minutes
        requiredFields: ['format']
    },
    screenshot: {
        actionType: 'screenshot',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 2 * 60 * 1000, // 2 minutes
        requiredFields: []
    },
    uninstall: {
        actionType: 'uninstall_app',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 5 * 60 * 1000, // 5 minutes
        requiredFields: ['packageName']
    },
    restartApp: {
        actionType: 'restart_app',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 2 * 60 * 1000, // 2 minutes
        requiredFields: ['packageName']
    },
    config: {
        actionType: 'config_app',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: 3 * 60 * 1000, // 3 minutes
        requiredFields: ['packageName']
    }
} as const;

type ActionType = keyof typeof ACTION_CONFIGS;

export const POST: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, request } = event;
        const deviceId = params.id;
        
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
            const body = await request.json();
            const { action, ...payload } = body;

            if (!action || !(action in ACTION_CONFIGS)) {
                return json({ 
                    success: false, 
                    error: { 
                        code: 'INVALID_REQUEST', 
                        message: `Invalid action. Supported actions: ${Object.keys(ACTION_CONFIGS).join(', ')}`,
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                }, { status: 400 });
            }

            const actionConfig = ACTION_CONFIGS[action as ActionType];
            
            // Validate required fields
            for (const field of actionConfig.requiredFields) {
                if (!payload[field] || !String(payload[field]).trim()) {
                    return json({ 
                        success: false, 
                        error: { 
                            code: 'INVALID_REQUEST', 
                            message: `Missing required field: ${field}`,
                            timestamp: new Date().toISOString(),
                            requestId: crypto.randomUUID()
                        }
                    }, { status: 400 });
                }
            }

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
            if (event.auth.user.systemRole !== SystemRole.ADMIN && device.user.id !== event.auth.user.id) {
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

            // Create action log entry
            const requestId = crypto.randomUUID();
            const created = await ActionLogger.createInitiated({
                deviceId,
                actionType: actionConfig.actionType,
                initiatedBy: event.auth.user.id,
                requestId,
                connectionId: 'api',
                protocol: 'api',
                metadata: {
                    action,
                    payload,
                    initiatedBy: event.auth.user.email
                },
                initialMessage: `Initiating ${action} action`
            });

            // Send command to device via SSE
            const routingMessage = MessageFactory.createSystemMessage(
                actionConfig.sseAction,
                `subscription:device:${deviceId}`,
                {
                    action,
                    deviceId,
                    ...payload,
                    logId: created.id,
                    requestId
                },
                SystemUser,
                { echoToSender: false }
            );

            await publisher.publish(routingMessage);

            // Set up timeout
            setTimeout(async () => {
                try {
                    const current = await prisma.deviceActionLog.findUnique({ 
                        where: { id: created.id }, 
                        select: { status: true } 
                    });
                    if (!current) return;
                    
                    if (current.status === 'initiated' || current.status === 'in_progress') {
                        await ActionLogger.finalize(created.id, 'failed', `${action} timed out after ${Math.floor(actionConfig.timeout / 60000)} minutes`);
                    }
                } catch (timeoutErr) {
                    logger.warn(`[UnifiedActionAPI] Failed to process ${action} timeout for ${created.id}: ${String(timeoutErr)}`);
                }
            }, actionConfig.timeout);

            logger.info(`[UnifiedActionAPI] ${action} action initiated for device ${deviceId} by user ${event.auth.user.email}`);

            return json({
                success: true,
                data: {
                    operationId: created.id,
                    deviceId,
                    action,
                    status: 'initiated',
                    message: `${action} action initiated`,
                    payload,
                    timestamp: new Date().toISOString(),
                    requestId
                }
            });

        } catch (error) {
            logger.error(`[UnifiedActionAPI] Error handling action request: ${String(error)}`);
            return json({ 
                success: false, 
                error: { 
                    code: 'OPERATION_FAILED', 
                    message: 'Failed to initiate action',
                    details: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
