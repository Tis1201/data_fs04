import type { RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

/********************************************************************************************
 * Derive the client IP address for a request.
 *
 * Priority:
 * - Use the first value from the x-forwarded-for header when present.
 * - Fallback to SvelteKit's getClientAddress helper.
 * Returns null if no reliable IP can be determined.
 *
 * This helper is intended for server-side routes and actions only.
 ********************************************************************************************/
export function getClientIp(event: Parameters<RequestHandler>[0]): string | null {
    const forwardedFor = event.request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const [first] = forwardedFor.split(',');
        if (first?.trim()) {
            return first.trim();
        }
    }

    try {
        return event.getClientAddress?.() ?? null;
    } catch (err) {
        logger.debug(`[FactoryMqttMintAPI] getClientAddress failed: ${String(err)}`);
        return null;
    }
}
