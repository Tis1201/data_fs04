import { json, type RequestHandler } from '@sveltejs/kit';
import { restrictDevice } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';
import jwt, { type Algorithm } from 'jsonwebtoken';

/**
 * Returns a JWT for an authenticated device.
 * The device authenticates via its X-API-Key header which is validated by `restrict_device`.
 */
export const GET: RequestHandler = restrictDevice(
    async ({ request, locals, device, userInfo }) => {
        
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

        if (!signingKey.privateKey) {
            logger.error('Signing key is missing private key material');
            return json(
                createErrorResponse(
                    'Signing key misconfigured',
                    {
                        details: 'Primary signing key does not include privateKey'
                    }
                ),
                { status: 500 }
            );
        }

       
        try{
            const algorithm: Algorithm = (signingKey.algorithm as Algorithm | null) ?? 'HS256';
            const token = jwt.sign(
                {
                    deviceId: device.id,
                    accountId: device.accountId,
                    userId: userInfo.id,
                    deviceName: device.name,
                    // you can add roles, scopes, etc. here
                },
                signingKey.privateKey, // or .secret if using HMAC
                {
                    algorithm, // depends on your DB model
                    expiresIn: '1h',
                    issuer: 'fs04',
                    audience: 'https://fs04.datarealities.com', // Added audience claim
                    subject: device.id,
                    keyid: signingKey.id,
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
