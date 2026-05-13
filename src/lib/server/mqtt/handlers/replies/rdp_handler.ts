import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { sendNotificationWithTicket, type NotificationTicketEnvelope } from '../../core/publish';
import { ActionLogger } from '$lib/server/action-logger';
import { broadcastDeviceActionUpdate } from '../index';

/********************************************************************************************
 * Handle RDP messages from device
 * Forwards RDP messages (status, started, stopped, error) to user
 * Also updates action logs based on connection status
 ********************************************************************************************/
export async function handleRdpMessage(
    prisma: PrismaClient,
    ctx: NotificationTicketEnvelope,
    result: Record<string, unknown>
): Promise<boolean> {
    const payload = (result.payload as Record<string, unknown> | undefined) || {};
    const payloadType = payload.type as string | undefined;

    if (payloadType && (
        payloadType === 'rdp:status' ||
        payloadType === 'rdp:started' ||
        payloadType === 'rdp:stopped' ||
        payloadType === 'rdp:error' ||
        payloadType === 'rdp:frame'
    )) {
        logger.debug('[MQTT Reply] Detected RDP message, forwarding to user', {
            type: payloadType
        });

        // Extract operationId from params to update action log
        const operationId = (ctx.params?.operationId as string | undefined) || 
                           (result.operationId as string | undefined) ||
                           (result.operation_id as string | undefined);

        // Update action log based on message type
        if (operationId) {
            try {
                // Handle rdp:started notification (sent after first frame is successfully sent)
                if (payloadType === 'rdp:started') {
                    // RDP session started successfully (first frame was sent, video is streaming)
                    const currentLog = await prisma.deviceActionLog.findUnique({
                        where: { id: operationId },
                        select: { status: true }
                    });
                    
                    // Only update to success if still in initiated or in_progress
                    if (currentLog && (currentLog.status === 'initiated' || currentLog.status === 'in_progress')) {
                        await ActionLogger.finalize(operationId, 'success', 'RDP session started successfully');
                        
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
                                    action: 'remote_desktop',
                                    status: 'success',
                                    message: 'RDP session started successfully',
                                    accountId: device.accountId
                                });
                            }
                        }
                    }
                } else if (payloadType === 'rdp:error') {
                    // RDP session failed to start
                    const errorMessage = (payload.message as string | undefined) || 
                                      (payload.error as string | undefined) || 
                                      'RDP session failed to start';
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
                                action: 'remote_desktop',
                                status: 'failed',
                                message: errorMessage,
                                accountId: device.accountId
                            });
                        }
                    }
                }
            } catch (logUpdateErr) {
                logger.warn('[MQTT Reply] Failed to update action log for RDP message', {
                    operationId,
                    error: logUpdateErr instanceof Error ? logUpdateErr.message : String(logUpdateErr)
                });
            }
        }

        // Remove conflicting 'type' field from params to ensure client uses JWT 'type'
        const cleanParams = { ...result };
        if (typeof cleanParams.type === 'string' && cleanParams.type !== 'device:rdp') {
            logger.debug('[MQTT Reply] Removed conflicting type field from RDP params', {
                originalTypeInParams: cleanParams.type,
                jwtType: 'device:rdp'
            });
            delete cleanParams.type;
        }

        // Forward RDP message immediately to user
        if (ctx.sub && ctx.recipient) {
        await sendNotificationWithTicket({
            prisma,
            sub: ctx.recipient, // original user
            recipient: ctx.sub,  // device
            type: 'device:rdp',
            flowId: ctx.flowId,
            params: cleanParams,
            expiresIn: '5m'
        });
        }

        return true; // Indicates this was handled
    }

    return false; // Not an RDP message
}
