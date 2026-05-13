/**
 * System Job: Timeout Action Logs
 *
 * Marks DeviceActionLog records that have been in_progress, pending, or initiated for too long
 * (e.g. device never responded, connection dropped) as failed so the UI doesn't show them
 * as "In Progress" forever.
 *
 * After updating the DB, broadcasts each change via MQTT so the UI updates in real-time.
 */

import type { Job } from 'bullmq';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

const DEFAULT_TIMEOUT_MINUTES = 2;

/** Reboot causes device to go offline; allow longer for device to reconnect and process queued action */
const REBOOT_TIMEOUT_MINUTES = 10;

export interface TimeoutActionLogsData {
    timeoutMinutes?: number;
}

export interface TimeoutActionLogsResult {
    updated: number;
}

export async function timeoutActionLogs(
    data: TimeoutActionLogsData,
    job: Job<TimeoutActionLogsData, TimeoutActionLogsResult>
): Promise<TimeoutActionLogsResult> {
    const timeoutMinutes = data.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const rebootCutoff = new Date(Date.now() - REBOOT_TIMEOUT_MINUTES * 60 * 1000);

    logger.info(
        `[Jobs/timeout-action-logs] Checking for incomplete action logs (${timeoutMinutes} min default, ${REBOOT_TIMEOUT_MINUTES} min for reboot)`
    );

    const prisma = getAdminPrisma();

    // Find action logs still stuck that are older than default cutoff
    const candidateLogs = await prisma.deviceActionLog.findMany({
        where: {
            status: { in: ['in_progress', 'initiated', 'pending'] },
            initiatedAt: { lt: cutoff }
        },
        select: { id: true, deviceId: true, actionType: true, initiatedAt: true }
    });

    // Reboot uses longer timeout (device goes offline; may be queued until device reconnects)
    const staleLogs = candidateLogs.filter(
        (log) =>
            log.actionType !== 'reboot' || (log.initiatedAt && log.initiatedAt < rebootCutoff)
    );

    if (staleLogs.length === 0) {
        logger.debug('[Jobs/timeout-action-logs] No stale action logs found');
        return { updated: 0 };
    }

    logger.info(`[Jobs/timeout-action-logs] Found ${staleLogs.length} stale log(s), marking as failed and broadcasting...`);

    // Lazy-import broadcaster to avoid any circular dep issues at module load time
    const { ActionLogEventBroadcaster } = await import(
        '$lib/server/mqtt/broadcasters/actionLogEventBroadcaster'
    );

    let updated = 0;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    const rebootTimeoutMs = REBOOT_TIMEOUT_MINUTES * 60 * 1000;

    for (const staleLog of staleLogs) {
        try {
            const completedAt = new Date();
            // Use configured timeout as duration (not actual elapsed) - the job runs every minute
            // so actual elapsed could be 2-3 min; showing the timeout value is more accurate
            const durationMs =
                staleLog.actionType === 'reboot' ? rebootTimeoutMs : timeoutMs;

            // Update individually so we get the full record back for broadcasting
            const updatedLog = await (prisma as any).deviceActionLog.update({
                where: { id: staleLog.id },
                data: {
                    status: 'failed',
                    completedAt,
                    durationMs,
                    error: 'Action timed out: device did not respond within timeout',
                    message: 'Failed to complete: device did not respond within timeout'
                }
            });

            // Broadcast via MQTT so the UI updates in real-time
            try {
                await ActionLogEventBroadcaster.broadcastActionLogEvent(
                    prisma as any,
                    updatedLog,
                    'updated'
                );
            } catch (broadcastErr) {
                logger.warn('[Jobs/timeout-action-logs] Broadcast failed for log (DB update succeeded)', {
                    logId: staleLog.id,
                    error: broadcastErr instanceof Error ? broadcastErr.message : String(broadcastErr)
                });
            }

            updated++;
        } catch (err) {
            logger.error('[Jobs/timeout-action-logs] Failed to update log', {
                logId: staleLog.id,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    logger.info(`[Jobs/timeout-action-logs] Marked ${updated} stale action log(s) as failed`);
    return { updated };
}
