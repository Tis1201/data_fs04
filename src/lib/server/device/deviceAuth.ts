import { json } from '@sveltejs/kit';
import type { PrismaClient } from '@prisma/client';
import type { UserInfo } from '$lib/server/types/user';
import { userInfoByUserId } from '$lib/server/security/auth-utils';
import { logger } from '$lib/server/logger';

/**
 * Authenticates a device using an API key from the request headers
 * @param locals App locals containing Prisma client
 * @param request The incoming request object
 * @returns Object containing the authenticated device and user info
 * @throws {Response} Throws a JSON response with error details if authentication fails
 */
export async function auth_device(
    locals: App.Locals, 
    request: Request
): Promise<{ device: any; userInfo: UserInfo }> {
    const apiKey = request.headers.get('x-api-key') || request.headers.get('x-api-Key');

    if (!apiKey) {
        logger.warn('No API Key provided');
        throw json({ error: 'No API Key provided' }, { status: 400 });
    }

    // Find device by apiKey
    const device = await locals.prisma.device.findFirst({
        where: { apiKey },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    systemRole: true
                }
            }
        }
    });

    if (!device) {
        logger.warn(`Invalid API key: ${apiKey.substring(0, 8)}...`);
        throw json({ error: 'Invalid API key', code: 'INVALID_API_KEY' }, { status: 401 });
    }

    logger.info(`Device ${device.id} (${device.name || 'unnamed'}) connected via API key, owned by: ${device.user.name}`);

    const userInfo = await userInfoByUserId(device.user.id, locals.prisma);
    
    // Add debugging to check device object structure
    logger.debug(`Device object structure: ${JSON.stringify({
        deviceId: device.id,
        deviceKeys: Object.keys(device)
    })}`);
    
    return { device, userInfo };
}
