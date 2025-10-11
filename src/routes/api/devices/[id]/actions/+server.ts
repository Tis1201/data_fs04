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
import { TimeoutConfig } from '$lib/server/config/timeoutConfig';

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
        timeout: TimeoutConfig.DEVICE_ACTION,
        requiredFields: ['packageName']
    },
    pushFile: {
        actionType: 'push_file',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: TimeoutConfig.DEVICE_ACTION + (5 * 60 * 1000), // 15 minutes (10 + 5)
        requiredFields: ['sourcePath', 'destinationPath']
    },
    pullFile: {
        actionType: 'pull_file',
        sseAction: 'device:actionRequest', // UNIFIED MESSAGE TYPE
        timeout: TimeoutConfig.DEVICE_ACTION,
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
        timeout: TimeoutConfig.DEVICE_ACTION,
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
        
        logger.info(`[UnifiedActionAPI] ========== REQUEST START ==========`);
        logger.info(`[UnifiedActionAPI] Device ID: ${deviceId}`);
        logger.info(`[UnifiedActionAPI] User: ${event.auth.user.email} (${event.auth.user.systemRole})`);
        logger.info(`[UnifiedActionAPI] User ID: ${event.auth.user.id}`);
        
        if (!deviceId) {
            logger.warn(`[UnifiedActionAPI] Missing device ID`);
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
            
            logger.info(`[UnifiedActionAPI] Request body:`, { action, payload });

            if (!action || !(action in ACTION_CONFIGS)) {
                logger.warn(`[UnifiedActionAPI] Invalid action: ${action}`);
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
            logger.info(`[UnifiedActionAPI] Action config:`, actionConfig);
            
            // Validate required fields
            for (const field of actionConfig.requiredFields) {
                if (!payload[field] || !String(payload[field]).trim()) {
                    logger.warn(`[UnifiedActionAPI] Missing required field: ${field}`);
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

            logger.info(`[UnifiedActionAPI] Fetching device from database...`);
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

            logger.info(`[UnifiedActionAPI] Device query result:`, device ? { id: device.id, name: device.name, connected: device.connected, userId: device.user.id } : null);

            if (!device) {
                logger.warn(`[UnifiedActionAPI] Device not found: ${deviceId}`);
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
                logger.warn(`[UnifiedActionAPI] Access denied: user ${event.auth.user.id} tried to access device owned by ${device.user.id}`);
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
                logger.warn(`[UnifiedActionAPI] Device is offline: ${deviceId}`);
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

            logger.info(`[UnifiedActionAPI] Creating action log entry...`);
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
            
            logger.info(`[UnifiedActionAPI] Action log created:`, { logId: created.id, requestId });

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
            
            logger.info(`[UnifiedActionAPI] Publishing message to device...`, { 
                sseAction: actionConfig.sseAction, 
                scope: `subscription:device:${deviceId}`,
                payload: { action, deviceId, logId: created.id }
            });

            await publisher.publish(routingMessage);
            
            logger.info(`[UnifiedActionAPI] Message published successfully`);

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
            logger.info(`[UnifiedActionAPI] ========== REQUEST END (SUCCESS) ==========`);

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
            logger.error(`[UnifiedActionAPI] Error stack:`, error instanceof Error ? error.stack : 'No stack');
            logger.error(`[UnifiedActionAPI] ========== REQUEST END (ERROR) ==========`);
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
