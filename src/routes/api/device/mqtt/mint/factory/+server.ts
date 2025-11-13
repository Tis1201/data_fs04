import { json, type RequestHandler } from '@sveltejs/kit';
import jwt, { type Algorithm } from 'jsonwebtoken';

import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';
import { logger } from '$lib/server/logger';
import { createErrorResponse, createSuccessResponse } from '$lib/server/types/api';

function getClientIp(event: Parameters<RequestHandler>[0]): string | null {
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

export const POST: RequestHandler = async (event) => {
    const { request, locals } = event;

    try {
        const claims = await verifyFactoryJWT(locals, request);
        const hardwareFingerprint = (claims.hw as string | undefined) ?? (claims.serialNumber as string | undefined) ?? null;
        const factoryJwtId = (claims.jti as string | undefined) ?? null;
        const userAgent = request.headers.get('user-agent') ?? null;
        const clientIp = getClientIp(event);
        const metadataPayload = {
            factoryJwtId,
            hw: hardwareFingerprint,
            claims
        };

        const timestamp = new Date();

        let factoryDevice;
        if (hardwareFingerprint) {
            factoryDevice = await locals.prisma.factoryDevice.upsert({
                where: { hardwareFingerprint },
                update: {
                    factoryJwtId,
                    metadata: JSON.stringify(metadataPayload),
                    lastSeenAt: timestamp,
                    lastSeenIp: clientIp,
                    lastSeenUserAgent: userAgent
                },
                create: {
                    hardwareFingerprint,
                    factoryJwtId,
                    metadata: JSON.stringify(metadataPayload),
                    lastSeenAt: timestamp,
                    lastSeenIp: clientIp,
                    lastSeenUserAgent: userAgent
                }
            });
        } else {
            factoryDevice = await locals.prisma.factoryDevice.create({
                data: {
                    factoryJwtId,
                    metadata: JSON.stringify(metadataPayload),
                    lastSeenAt: timestamp,
                    lastSeenIp: clientIp,
                    lastSeenUserAgent: userAgent
                }
            });
        }

        const signingKey = await locals.prisma.jwtSigningKey.findFirst({
            where: {
                keyType: 'LINK',
                isPrimary: true,
                isActive: true
            }
        });

        if (!signingKey) {
            logger.error('[FactoryMqttMintAPI] No active signing key found');
            return json(
                createErrorResponse('No active signing key found', {
                    details: 'Missing signing key'
                }),
                { status: 500 }
            );
        }

        const algorithm = (signingKey.algorithm ?? 'HS256') as Algorithm;
        const token = jwt.sign(
            {
                factoryDeviceId: factoryDevice.id,
                hardwareFingerprint,
                scope: 'factory:mqtt'
            },
            signingKey.privateKey,
            {
                algorithm,
                expiresIn: '15m',
                issuer: 'fs04',
                audience: 'https://fs04.datarealities.com',
                subject: factoryDevice.id,
                keyid: signingKey.id
            }
        );

        logger.info(`[FactoryMqttMintAPI] Minted MQTT credential for factory device ${factoryDevice.id}`);

        return json(
            createSuccessResponse({
                jwt: token,
                factoryDeviceId: factoryDevice.id
            })
        );
    } catch (err) {
        if (err instanceof Response) {
            return err;
        }

        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[FactoryMqttMintAPI] Error: ${message}`);

        return json(
            createErrorResponse('Unauthorized factory token', {
                details: message
            }),
            { status: 401 }
        );
    }
};
