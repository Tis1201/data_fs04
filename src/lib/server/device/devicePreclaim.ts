import type { RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

/**
 * Normalize MAC address to uppercase, colon-separated pairs.
 * Examples:
 *  - "fa:d9:70:ac:8e:ca" -> "FA:D9:70:AC:8E:CA"
 *  - "FA-D9-70-AC-8E-CA" -> "FA:D9:70:AC:8E:CA"
 *  - "FAD970AC8ECA" -> "FA:D9:70:AC:8E:CA"
 */
function normalizeMac(mac: string): string {
    const hex = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    const even = hex.length % 2 === 0 ? hex : `0${hex}`;
    return even.match(/.{1,2}/g)?.join(':') ?? '';
}

/** Get uppercase MAC without any separators (for matching legacy stored values). */
function macNoSeparators(mac: string): string {
    return mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

export type PreclaimCheckResult = {
    normalizedMac: string; // colon-separated (display-friendly)
    noSepMac: string;      // no separators (legacy storage)
    preclaim:
        | {
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
          }
        | null;
};

/**
 * Checks if there is an active, unclaimed preclaim for the device identified by the X-Device-MAC header.
 * - Uses locals.prisma per project convention
 * - Returns the normalized MAC and the preclaim record (or null)
 */
export async function checkDevicePreclaim(locals: RequestEvent['locals'], request: Request): Promise<PreclaimCheckResult | null> {
    try {
        const macHeader = request.headers.get('X-Device-MAC');
        if (!macHeader) {
            logger.debug('checkDevicePreclaim: no X-Device-MAC header');
            return null;
        }

        const normalizedMac = normalizeMac(macHeader);
        const noSepMac = macNoSeparators(macHeader);
        if (!noSepMac) {
            logger.debug(`checkDevicePreclaim: invalid MAC '${macHeader}' after normalization`);
            return null;
        }

        const now = new Date();
        const preclaim = await locals.prisma.preclaimDevice.findFirst({
            where: {
                OR: [
                    { macId: normalizedMac },
                    { macId: noSepMac }
                ],
                status: 'PENDING',
                claimedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            },
            select: {
                id: true,
                macId: true,
                name: true,
                description: true,
                status: true,
                expiresAt: true,
                claimedAt: true,
                accountId: true,
                setId: true,
                deviceId: true
            }
        });

        if (preclaim) {
            logger.info(`checkDevicePreclaim: found active preclaim for MAC ${normalizedMac} (normNoSep=${noSepMac}, preclaimId=${preclaim.id})`);
        } else {
            logger.debug(`checkDevicePreclaim: no active preclaim for MAC ${normalizedMac} (normNoSep=${noSepMac})`);
        }

        return { normalizedMac, noSepMac, preclaim };
    } catch (err) {
        logger.error(`checkDevicePreclaim error: ${err}`);
        return null;
    }
}
