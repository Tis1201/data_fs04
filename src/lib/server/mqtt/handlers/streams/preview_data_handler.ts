import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { decodeNotificationTicket, sendNotificationWithTicket } from '../core/publish';
import { getMqttTransport } from '../core/transport';
import { getPreviewSession, isSessionExpired } from '../sessions/preview_sessions';

/**
 * Handles controller data streams (sensor preview)
 * Supports both ticket-based stateless routing (preferred) and legacy session-based routing
 */
export async function handlePreviewDataMessage(
    topic: string,
    payload: Buffer,
    prisma: PrismaClient
): Promise<void> {
    const raw = payload.toString('utf8');
    try {
        const data = JSON.parse(raw);

        // NEW: Ticket-based stateless routing (preferred)
        // Controller echoes the ticket from preview.start with each data frame
        if (data.type === 'preview.frame' && data.ticket) {
            try {
                // Verify ticket and extract routing claims
                const claims = await decodeNotificationTicket(prisma, data.ticket);

                // Forward to USER (not device) - the sub contains the user subject
                // Topic format: user/{sub}/notifications
                const userNotificationTopic = `user/${claims.sub}/notifications`;
                const transport = getMqttTransport();

                const notification = {
                    type: 'preview.data',
                    flowId: claims.flowId,
                    params: {
                        sessionId: claims.params?.sessionId,
                        sensorId: claims.params?.sensorId,
                        timestamp: data.timestamp || Date.now(),
                        data: data.data || data
                    }
                };

                await transport.publish(userNotificationTopic, JSON.stringify(notification), { qos: 0 });
                // Note: Removed per-frame logging to reduce console spam
            } catch (ticketErr) {
                // Ticket verification failed (expired, invalid signature, etc.)
                logger.debug('[Preview] Ticket verification failed, ignoring data frame', {
                    error: ticketErr instanceof Error ? ticketErr.message : String(ticketErr)
                });
            }
            return;
        }

        // LEGACY: In-memory session-based routing (backwards compatibility)
        // TODO: Deprecate once all controllers use ticket-based routing
        if (data.type === 'preview.frame' && data.sessionId) {
            const session = getPreviewSession(data.sessionId);

            if (session && !isSessionExpired(data.sessionId)) {
                await sendNotificationWithTicket({
                    prisma,
                    sub: `device:${session.deviceId}`,
                    recipient: `user:${session.userId}:${session.accountId}`,
                    type: 'preview.data',
                    flowId: session.flowId,
                    params: {
                        sessionId: session.sessionId,
                        sensorId: session.sensorId,
                        timestamp: data.timestamp || Date.now(),
                        data: data.data || data
                    },
                    expiresIn: '1m'
                });
            }
        }
    } catch (err) {
        // Ignore malformed data messages to prevent log spam
    }
}
