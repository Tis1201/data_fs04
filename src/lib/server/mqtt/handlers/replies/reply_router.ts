import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { decodeNotificationTicket, sendNotificationWithTicket, type NotificationTicketEnvelope } from '../../core/publish';
import { handleStatusUpdate } from './status_update_handler';
import { handleProgressUpdate } from './progress_update_handler';
import { handleTerminalMessage } from './terminal_handler';
import { handleRdpMessage } from './rdp_handler';
import { handleWebRtcMessage } from './webrtc_handler';
import { handleScreenshotMessage } from './screenshot_handler';

/********************************************************************************************
 * Main router for all reply messages
 * Processes device replies, routes to appropriate handlers, and forwards notifications
 ********************************************************************************************/
export async function handleReplyMessage(
    topic: string,
    payload: Buffer,
    prisma: PrismaClient
): Promise<void> {
    const rawReply = payload.toString('utf8');

    try {
        const reply = JSON.parse(rawReply) as { ticket?: string; result?: unknown };
        const { ticket, result } = reply;

        if (!ticket) {
            logger.error('[MQTT Reply] Missing ticket in reply payload', { topic, rawReply });
            return;
        }

        const ctx: NotificationTicketEnvelope = await decodeNotificationTicket(prisma, ticket);

        if (!ctx.sub) {
            logger.error('[MQTT Reply] Missing sub in notification ticket', { topic });
            return;
        }

        if (!ctx.recipient) {
            logger.error('[MQTT Reply] Missing recipient in notification ticket', { topic });
            return;
        }

        if (!ctx.flowId) {
            logger.error('[MQTT Reply] Missing flowId in notification ticket', { topic });
            return;
        }

        if (!result || typeof result !== 'object' || Array.isArray(result)) {
            logger.error('[MQTT Reply] Reply result must be an object', { topic, rawReply });
            return;
        }

        // Update action log if this is a device status or progress update
        const resultObj = result as Record<string, unknown>;
        const messageType = resultObj.type as string;
        // Extract logId - from result first, then from ticket params (for config.update when device echoes different format)
        let logId = (resultObj.operationId as string) || (resultObj.logId as string);
        if (!logId && ctx.type === 'config.update' && ctx.params) {
            logId = (ctx.params.logId as string) || (ctx.params.operationId as string) || '';
        }
        const status = resultObj.status as string;
        const message = resultObj.message as string;
        const action = resultObj.action as string;

        // Handle device:statusUpdate (matches old SSE flow)
        // This updates the database and calculates durationMs
        let updatedLogData: { durationMs?: number | null; progress?: number | null } | null = null;
        if (logId && messageType === 'device:statusUpdate') {
            logger.info('[MQTT Reply] Received device reply (waiting step)', {
                topic,
                action,
                logId,
                status,
                message: message?.substring(0, 80)
            });
            await handleStatusUpdate(prisma, logId, action, status, message, resultObj);
            
            // Fetch the updated log to get calculated durationMs and progress
            // This ensures the JWT params include all calculated fields
            try {
                const updatedLog = await (prisma as any).deviceActionLog.findUnique({
                    where: { id: logId },
                    select: { durationMs: true, progress: true }
                });
                if (updatedLog) {
                    updatedLogData = {
                        durationMs: updatedLog.durationMs,
                        progress: updatedLog.progress
                    };
                    logger.debug('[MQTT Reply] Fetched updated log data for forwarding', {
                        logId,
                        durationMs: updatedLogData.durationMs,
                        progress: updatedLogData.progress
                    });
                }
            } catch (fetchErr) {
                logger.warn('[MQTT Reply] Failed to fetch updated log data', {
                    logId,
                    error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
                });
            }
        }

        // Fallback for config.update when device sends non-device:statusUpdate format
        // (e.g. mobile/legacy: { success, configVersion, appliedAt, message } without type/logId)
        if (logId && !updatedLogData && ctx.type === 'config.update') {
            const innerResult = resultObj.result as Record<string, unknown> | undefined;
            const success = resultObj.success ?? innerResult?.success;
            const derivedStatus = resultObj.status || (success === true ? 'success' : success === false ? 'failed' : null);
            const derivedMessage = resultObj.message ?? innerResult?.message ?? (derivedStatus === 'success' ? 'Config applied successfully' : 'Config update failed');
            if (derivedStatus === 'success' || derivedStatus === 'failed') {
                logger.info('[MQTT Reply] config.update fallback: updating Action Log from non-statusUpdate format', {
                    logId,
                    derivedStatus,
                    resultKeys: Object.keys(resultObj)
                });
                const normalisedResult = { ...resultObj, status: derivedStatus, message: derivedMessage, action: 'config.update' };
                await handleStatusUpdate(prisma, logId, 'config.update', derivedStatus, derivedMessage, normalisedResult);
                try {
                    const updatedLog = await (prisma as any).deviceActionLog.findUnique({
                        where: { id: logId },
                        select: { durationMs: true, progress: true }
                    });
                    if (updatedLog) {
                        updatedLogData = { durationMs: updatedLog.durationMs, progress: updatedLog.progress };
                    }
                } catch {
                    // Ignore
                }
            }
        }

        // Handle device:progressUpdate (for progress percentage updates)
        if (logId && messageType === 'device:progressUpdate') {
            await handleProgressUpdate(prisma, logId, action, resultObj);
            
            // Fetch updated progress for forwarding
            try {
                const updatedLog = await (prisma as any).deviceActionLog.findUnique({
                    where: { id: logId },
                    select: { progress: true }
                });
                if (updatedLog && updatedLog.progress !== undefined && updatedLog.progress !== null) {
                    if (!updatedLogData) {
                        updatedLogData = {};
                    }
                    updatedLogData.progress = updatedLog.progress;
                }
            } catch (fetchErr) {
                logger.warn('[MQTT Reply] Failed to fetch updated progress', {
                    logId,
                    error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
                });
            }
        }

        // Handle terminal output - forward immediately to user
        // Terminal messages: terminal:output, terminal:connected, terminal:error, terminal:disconnected
        if (ctx.type === 'device:terminal' ||
            (result && typeof result === 'object' && !Array.isArray(result))) {
            const wasHandled = await handleTerminalMessage(prisma, ctx, resultObj);
            if (wasHandled) {
                return; // Terminal output forwarded, no need to process further
            }

            // Handle RDP messages from device (rdp:status, rdp:error, etc.)
            const wasRdpHandled = await handleRdpMessage(prisma, ctx, resultObj);
            if (wasRdpHandled) {
                return; // RDP message forwarded, no need to process further
            }

            // Handle WebRTC messages from device (webrtc:offer, webrtc:ice-candidate, etc.)
            const wasWebRtcHandled = await handleWebRtcMessage(prisma, ctx, resultObj);
            if (wasWebRtcHandled) {
                return; // WebRTC message forwarded, no need to process further
            }
        }

        // Extract payload fields for screenshot responses (device sends objectPath in payload)
        // Device sends: { type: "device", payload: { objectPath: "...", format: "..." } }
        // Generate download URL server-side so UI can use it directly
        let notificationParams = resultObj;
        let notificationType = ctx.type;

        // Handle screenshot responses and errors
        const screenshotResult = await handleScreenshotMessage(prisma, ctx, resultObj);
        if (screenshotResult.isScreenshotResponse || screenshotResult.isScreenshotError) {
            notificationParams = screenshotResult.notificationParams;
            notificationType = screenshotResult.notificationType;
        }

        // For progress and status updates, change notification type to match the actual message
        // so the UI can listen for the correct notification type
        if (messageType === 'device:statusUpdate') {
            notificationType = 'device:statusUpdate';
            logger.debug('[MQTT Reply] Forwarding as device:statusUpdate', {
                originalType: ctx.type,
                action,
                status
            });
        } else if (messageType === 'device:progressUpdate') {
            notificationType = 'device:progressUpdate';
            logger.debug('[MQTT Reply] Forwarding as device:progressUpdate', {
                originalType: ctx.type,
                action,
                progress: resultObj.progress
            });
        }

        // Remove conflicting 'type' field from params to prevent client from reading wrong type
        // The client reads payload.params.type first, which would override the JWT's type claim
        const cleanParams = { ...notificationParams };
        const hadConflictingType = 'type' in cleanParams;
        delete cleanParams.type;

        if (hadConflictingType) {
            logger.debug('[MQTT Reply] Removed conflicting type field from params', {
                removedType: notificationParams.type,
                jwtType: notificationType
            });
        }

        // Include calculated durationMs and progress from database in params
        // This ensures real-time updates include all calculated fields
        if (updatedLogData) {
            if (updatedLogData.durationMs !== undefined && updatedLogData.durationMs !== null) {
                cleanParams.durationMs = updatedLogData.durationMs;
                logger.debug('[MQTT Reply] Added durationMs to notification params', {
                    logId,
                    durationMs: updatedLogData.durationMs
                });
            }
            if (updatedLogData.progress !== undefined && updatedLogData.progress !== null) {
                cleanParams.progress = updatedLogData.progress;
                logger.debug('[MQTT Reply] Added progress to notification params', {
                    logId,
                    progress: updatedLogData.progress
                });
            }
        }

        logger.info('[MQTT Reply] Forwarding notification to user', {
            notificationType,
            recipient: ctx.sub,
            sub: ctx.recipient,
            flowId: ctx.flowId,
            hasParams: !!cleanParams,
            paramKeys: cleanParams ? Object.keys(cleanParams) : []
        });

        await sendNotificationWithTicket({
            prisma,
            sub: ctx.recipient,
            recipient: ctx.sub,
            type: notificationType,
            flowId: ctx.flowId,
            params: cleanParams,
            expiresIn: '5m'
        });

        logger.debug('[MQTT Reply] Notification forwarded successfully', {
            notificationType,
            recipient: ctx.sub
        });
    } catch (err) {
        logger.error(
            `[MQTT Reply] Failed to process reply message: ${
                err instanceof Error ? err.message : String(err)
            }`,
            { topic, rawReply }
        );
    }
}
