import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { sendNotificationWithTicket, type NotificationTicketEnvelope } from '../../core/publish';

/********************************************************************************************
 * Handle WebRTC messages from device
 * Forwards WebRTC messages (offer, answer, ice-candidate, connected, error) to user
 ********************************************************************************************/
export async function handleWebRtcMessage(
    prisma: PrismaClient,
    ctx: NotificationTicketEnvelope,
    result: Record<string, unknown>
): Promise<boolean> {
    const payload = (result.payload as Record<string, unknown> | undefined) || {};
    const payloadType = payload.type as string | undefined;

    if (payloadType && (
        payloadType === 'webrtc:offer' ||
        payloadType === 'webrtc:answer' ||
        payloadType === 'webrtc:ice-candidate' ||
        payloadType === 'webrtc:connected' ||
        payloadType === 'webrtc:error'
    )) {
        logger.debug('[MQTT Reply] Detected WebRTC message, forwarding to user', {
            type: payloadType
        });

        // Remove conflicting 'type' field from params to ensure client uses JWT 'type'
        const cleanParams = { ...result };
        if (typeof cleanParams.type === 'string' && cleanParams.type !== 'device:webrtc') {
            logger.debug('[MQTT Reply] Removed conflicting type field from WebRTC params', {
                originalTypeInParams: cleanParams.type,
                jwtType: 'device:webrtc'
            });
            delete cleanParams.type;
        }

        // Forward WebRTC message immediately to user
        await sendNotificationWithTicket({
            prisma,
            sub: ctx.recipient, // original user
            recipient: ctx.sub,  // device
            type: 'device:webrtc',
            flowId: ctx.flowId,
            params: cleanParams,
            expiresIn: '5m'
        });

        return true; // Indicates this was handled
    }

    return false; // Not a WebRTC message
}
