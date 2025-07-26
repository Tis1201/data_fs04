import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';

/**
 * Returns a JWT for an authenticated device.
 * The device authenticates via its X-API-Key header which is validated by `restrict_device`.
 */
export const GET: RequestHandler = restrictDevice(
    async ({ request, locals, device, userInfo }) => {
        // TODO create JWT for this device
        const token = 'dummy-jwt';          // replace with real signing logic
        logger.debug(`Device: ${JSON.stringify(device)}`);
        logger.debug(`User: ${JSON.stringify(userInfo)}`);

        // Get the primary signing key for access tokens
        const signingKey = await locals.prisma.jwtSigningKey.findFirst({
            where: {
                keyType: 'TOKEN',
                isPrimary: true,
                isActive: true
            }
        });

        if (!signingKey) {
            logger.error('No active signing key found');
            return json({ error: 'Server configuration error' }, { status: 500 });
        }

        return json({
            success: true,
            jwt: token,
            deviceId: device.id,
            userId: userInfo.id
        });
    }
);
