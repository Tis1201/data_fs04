/**
 * System Job: Timeout Stale Profile Applying
 *
 * Marks DeviceProfileAssignment records that have been APPLYING for too long
 * (e.g. device never reported back) as FAILED so the UI shows Failed instead of Applying.
 */

import type { Job } from 'bullmq';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

const DEFAULT_TIMEOUT_MINUTES = 3;

export interface TimeoutProfileApplyingData {
    timeoutMinutes?: number;
}

export interface TimeoutProfileApplyingResult {
    updated: number;
}

export async function timeoutProfileApplying(
    data: TimeoutProfileApplyingData,
    job: Job<TimeoutProfileApplyingData, TimeoutProfileApplyingResult>
): Promise<TimeoutProfileApplyingResult> {
    const timeoutMinutes = data.timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    logger.info(
        `[Jobs/timeout-profile-applying] Checking for APPLYING assignments older than ${timeoutMinutes} min (cutoff: ${cutoff.toISOString()})`
    );

    const prisma = getAdminPrisma();

    // Find assignments still APPLYING that are older than cutoff (use lastSyncAt if set, else assignedAt)
    const stale = await prisma.deviceProfileAssignment.findMany({
        where: {
            status: 'APPLYING',
            OR: [
                { lastSyncAt: { lt: cutoff } },
                { AND: [{ lastSyncAt: null }, { assignedAt: { lt: cutoff } }] }
            ]
        },
        select: { id: true, deviceId: true, profileId: true }
    });

    if (stale.length === 0) {
        logger.debug('[Jobs/timeout-profile-applying] No stale APPLYING assignments');
        return { updated: 0 };
    }

    const result = await prisma.deviceProfileAssignment.updateMany({
        where: { id: { in: stale.map((s) => s.id) } },
        data: { status: 'FAILED', lastSyncAt: new Date() }
    });

    logger.info(
        `[Jobs/timeout-profile-applying] Marked ${result.count} stale APPLYING assignment(s) as FAILED`
    );
    return { updated: result.count };
}
