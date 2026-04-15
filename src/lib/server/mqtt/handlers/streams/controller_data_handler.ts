/**
 * Controller `/data` stream handler.
 *
 * Entry point for all messages on `device:…/controller/…/data`:
 *
 * 1. `radar.usb.status` — radar USB link telemetry → {@link fanOutRadarUsbStatusToUsers}
 * 2. `preview.frame` (ticket) — stateless live-preview routing
 * 3. `preview.frame` (sessionId) — legacy in-memory session routing (deprecated)
 */

import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';
import { decodeNotificationTicket, sendNotificationWithTicket } from '../../core/publish';
import { getMqttTransport } from '../../core/transport';
import { getPreviewSession, isSessionExpired } from '../../sessions/preview_sessions';
import { fanOutRadarUsbStatusToUsers } from '../device/radar_usb_fanout';

/**
 * Accepts both `device:<id>/...` (IoT-style) and `device/<id>/...` (slash style).
 */
const RADAR_CONTROLLER_DATA_RE = /^device(?:\/|:)([^/]+)\/controller\/radar:([^/]+)\/data$/;

export async function handleControllerDataMessage(
    topic: string,
    payload: Buffer,
    prisma: PrismaClient
): Promise<void> {
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(payload.toString('utf8')) as Record<string, unknown>;
    } catch {
        return;
    }

    // ── Branch 1: Radar USB link status ──────────────────────────────────────
    if (data.type === 'radar.usb.status') {
        const tm = RADAR_CONTROLLER_DATA_RE.exec(topic);
        if (!tm) {
            logger.debug('[ControllerData] radar.usb.status ignored — topic shape not recognized', { topic });
            return;
        }
        const topicDeviceId = tm[1]!;
        const topicControllerId = tm[2]!;
        const deviceId = typeof data.deviceId === 'string' ? data.deviceId : topicDeviceId;
        const controllerId =
            typeof data.controllerId === 'string' ? data.controllerId : topicControllerId;

        if (deviceId !== topicDeviceId || controllerId !== topicControllerId) {
            logger.warn('[ControllerData] radar.usb.status topic vs payload mismatch', {
                topic,
                deviceId,
                controllerId
            });
            return;
        }

        await fanOutRadarUsbStatusToUsers(prisma, {
            deviceId,
            controllerId,
            sensorId: typeof data.sensorId === 'string' ? data.sensorId : undefined,
            usbConnected: Boolean(data.usbConnected),
            timestamp:
                typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString()
        });
        return;
    }

    // ── Branch 2: Ticket-based preview routing (preferred) ───────────────────
    const previewTicket = data.ticket;
    if (data.type === 'preview.frame' && typeof previewTicket === 'string') {
        try {
            const claims = await decodeNotificationTicket(prisma, previewTicket);
            const userNotificationTopic = `user/${claims.sub}/notifications`;
            const transport = getMqttTransport();

            const frameData = data.data || data;
            const timestamp = data.timestamp || Date.now();
            const notification = {
                type: 'preview.data',
                flowId: claims.flowId,
                timestamp,
                frameNumber: data.frameNumber,
                data: frameData,
                params: {
                    sessionId: claims.params?.sessionId,
                    sensorId: claims.params?.sensorId,
                    timestamp,
                    frameNumber: data.frameNumber,
                    data: frameData
                }
            };

            await transport.publish(userNotificationTopic, JSON.stringify(notification), { qos: 0 });
        } catch (ticketErr) {
            logger.debug('[ControllerData] Ticket verification failed, ignoring data frame', {
                error: ticketErr instanceof Error ? ticketErr.message : String(ticketErr)
            });
        }
        return;
    }

    // ── Branch 3: Legacy session-based preview routing ───────────────────────
    // TODO: Deprecate once all controllers use ticket-based routing
    const previewSessionId = data.sessionId;
    if (data.type === 'preview.frame' && typeof previewSessionId === 'string') {
        const session = getPreviewSession(previewSessionId);

        if (session && !isSessionExpired(previewSessionId)) {
            try {
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
            } catch (err) {
                logger.debug('[ControllerData] Legacy session routing error', {
                    error: err instanceof Error ? err.message : String(err)
                });
            }
        }
    }
}
