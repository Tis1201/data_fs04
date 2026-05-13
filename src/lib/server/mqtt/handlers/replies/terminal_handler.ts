import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { sendNotificationWithTicket, type NotificationTicketEnvelope } from '../../core/publish';
import { ActionLogger } from '$lib/server/action-logger';
import { broadcastDeviceActionUpdate } from '../index';

/********************************************************************************************
 * Handle terminal output messages
 * Forwards terminal messages (output, connected, error, disconnected) to user
 * Also updates action logs based on connection status
 ********************************************************************************************/
export async function handleTerminalMessage(
    prisma: PrismaClient,
    ctx: NotificationTicketEnvelope,
    result: Record<string, unknown>
): Promise<boolean> {
    const payload = (result.payload as Record<string, unknown> | undefined) || {};
    const payloadType = payload.type as string | undefined;

    if (payloadType && (
        payloadType === 'terminal:output' ||
        payloadType === 'terminal:connected' ||
        payloadType === 'terminal:error' ||
        payloadType === 'terminal:disconnected'
    )) {
        logger.debug('[MQTT Reply] Detected terminal output, forwarding to user', {
            type: payloadType,
            hasOutput: !!payload.output
        });

        // Extract operationId from params to update action log
        const operationId = (ctx.params?.operationId as string | undefined) || 
                           (result.operationId as string | undefined) ||
                           (result.operation_id as string | undefined);

        // Update action log based on message type
        if (operationId) {
            try {
                if (payloadType === 'terminal:connected') {
                    // Terminal connection successful
                    await ActionLogger.finalize(operationId, 'success', 'Terminal session created successfully');
                    
                    // Broadcast success status to UI
                    const deviceId = (ctx.params?.deviceId as string | undefined) || 
                                   (result.deviceId as string | undefined);
                    if (deviceId) {
                        const device = await prisma.device.findUnique({
                            where: { id: deviceId },
                            select: { accountId: true, createdBy: true }
                        });
                        if (device && device.accountId) {
                            await broadcastDeviceActionUpdate({
                                prisma,
                                deviceId,
                                logId: operationId,
                                action: 'terminal',
                                status: 'success',
                                message: 'Terminal session created successfully',
                                accountId: device.accountId
                            });
                        }
                    }
                } else if (payloadType === 'terminal:error') {
                    // Terminal connection failed
                    const errorMessage = (payload.message as string | undefined) || 
                                      (payload.error as string | undefined) || 
                                      'Terminal connection failed';
                    await ActionLogger.finalize(operationId, 'failed', errorMessage, errorMessage);
                    
                    // Broadcast failure status to UI
                    const deviceId = (ctx.params?.deviceId as string | undefined) || 
                                   (result.deviceId as string | undefined);
                    if (deviceId) {
                        const device = await prisma.device.findUnique({
                            where: { id: deviceId },
                            select: { accountId: true, createdBy: true }
                        });
                        if (device && device.accountId) {
                            await broadcastDeviceActionUpdate({
                                prisma,
                                deviceId,
                                logId: operationId,
                                action: 'terminal',
                                status: 'failed',
                                message: errorMessage,
                                accountId: device.accountId
                            });
                        }
                    }
                }
            } catch (logUpdateErr) {
                logger.warn('[MQTT Reply] Failed to update action log for terminal message', {
                    operationId,
                    error: logUpdateErr instanceof Error ? logUpdateErr.message : String(logUpdateErr)
                });
            }
        }

        // Remove conflicting 'type' field from params to ensure client uses JWT 'type'
        const cleanParams = { ...result };
        if (typeof cleanParams.type === 'string' && cleanParams.type !== 'device:terminal') {
            logger.debug('[MQTT Reply] Removed conflicting type field from terminal params', {
                originalTypeInParams: cleanParams.type,
                jwtType: 'device:terminal'
            });
            delete cleanParams.type;
        }

        // Forward terminal output immediately to user
        await sendNotificationWithTicket({
            prisma,
            sub: ctx.recipient, // original user
            recipient: ctx.sub,  // device
            type: 'device:terminal',
            flowId: ctx.flowId,
            params: cleanParams,
            expiresIn: '5m'
        });

        return true; // Indicates this was handled
    }

    return false; // Not a terminal message
}
