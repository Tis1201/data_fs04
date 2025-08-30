import type { RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

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
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
            }
        });

        return { mac, preclaim };
    } catch (err) {
        logger.error(`Preclaim check failed: ${err}`);
        return null;
    }
}
