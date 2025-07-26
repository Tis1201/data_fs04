import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';
import jwt from 'jsonwebtoken';

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
            return json(createErrorResponse(
                'No active signing key found',
                {
                    details: "Missing signing key"
                }
                
            ), { status: 500 });
        }

       
        try{
            const token = jwt.sign(
                {
                    deviceId: device.id,
                    userId: userInfo.id,
                    deviceName: device.name,
                    // you can add roles, scopes, etc. here
                },
                signingKey.privateKey, // or .secret if using HMAC
                {
                    algorithm: signingKey.algorithm || 'HS256', // depends on your DB model
                    expiresIn: '1h',
                    issuer: 'fs04',
                    subject: device.id,
                }
            );

            return json(createSuccessResponse({
                jwt: token,
            }))
        
        }catch(error){
            return json(createErrorResponse(
                error as Error               
            ), { status: 500 });
        }

        // const jwt = createJWT(signingKey, device.id, userInfo.id);

        

     
    }
);
