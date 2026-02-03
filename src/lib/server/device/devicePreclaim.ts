import type { RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

export type PreclaimCheckResult = {
    mac: string;
    preclaim: {
        id: string;
        macId: string;
        name: string | null;
        description: string | null;
        status: string;
        expiresAt: Date | null;
        claimedAt: Date | null;
        accountId: string;
        setId: string;
        deviceId: string | null;
    } | null;
};

export async function checkDevicePreclaim(locals: RequestEvent['locals'], request: Request): Promise<PreclaimCheckResult | null> {
    try {
        const mac = request.headers.get('X-Device-MAC');
        if (!mac) return null;

        const preclaim = await locals.prisma.preclaimDevice.findFirst({
            where: {
                macId: mac,
                status: 'PENDING',
                claimedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                set: { status: 'ACTIVE' }
            }
        });

        return { mac, preclaim };
    } catch (err) {
        logger.error(`Preclaim check failed: ${err}`);
        return null;
    }
}

/** When the last device in a preclaim set is claimed, mark the set as completed (set expiresAt to now so UI shows "Completed"). */
export async function markPreclaimSetCompletedIfAllClaimed(prisma: PrismaClient, setId: string): Promise<void> {
    try {
        const [total, fulfilled] = await Promise.all([
            prisma.preclaimDevice.count({ where: { setId } }),
            prisma.preclaimDevice.count({ where: { setId, status: 'FULFILLED' } })
        ]);
        if (total > 0 && total === fulfilled) {
            await prisma.preclaimSet.update({
                where: { id: setId },
                data: { expiresAt: new Date() }
            });
            logger.info(`[Preclaim] Set ${setId} marked completed (all ${total} devices claimed).`);
        }
    } catch (err) {
        logger.error(`[Preclaim] Failed to mark set ${setId} completed: ${err}`);
    }
}
