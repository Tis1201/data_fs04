import { json, type RequestHandler } from '@sveltejs/kit';

import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';
import { logger } from '$lib/server/logger';
import { buildMqttMintPayload, getMqttBrokerUrl, mintIoTCoreCredentials } from '$lib/server/mqtt/mint';
import { createErrorResponse, createSuccessResponse } from '$lib/server/types/api';
import { getClientIp } from '$lib/utils/request-utils';

/********************************************************************************************
 * Mint MQTT connection credentials for a factory device via IoT Core.
 *
 * - Validates local env configuration (MQTT_BROKER_URL, IOT_CORE_BASE_URL, IOT_CORE_API_KEY).
 * - Calls fs04_iot_core /api/mq/mint with a factory-specific username and topic ACLs.
 * - Returns a standardized success or error JSON response containing brokerUrl, clientId,
 *   username, and jwt (used as MQTT password).
 ********************************************************************************************/
async function mintFactoryMqttCredentials(factoryDeviceId: string) {
    const brokerUrl = getMqttBrokerUrl();
    if (!brokerUrl) {
        logger.error('[FactoryMqttMintAPI] MQTT_BROKER_URL is not configured');
        return json(
            createErrorResponse('MQTT broker URL is not configured', {
                details: 'Set MQTT_BROKER_URL in the server environment'
            }),
            { status: 500 }
        );
    }

    const username = `factory:${factoryDeviceId}`;
    const mintData = await mintIoTCoreCredentials({
        username,
        pubTopics: [
            `device/${username}/replies`,
            `device/${username}/requests`,
            `device/${username}/loopback`,
            `device/${username}/heartbeat`
        ],
        subTopics: [
            `device/${username}/response`,
            `device/${username}/notifications`,
            `device/${username}/loopback`
        ]
    });

    if (!mintData) {
        return json(
            createErrorResponse('Failed to mint MQTT credentials from IoT Core', {
                details: 'See server logs for IoT Core mint failure details'
            }),
            { status: 502 }
        );
    }

    const { clientId, token, username: mintedUsername } = mintData;

    logger.info(
        `[FactoryMqttMintAPI] Minted MQTT credential via IoT Core for factory device ${factoryDeviceId} (clientId=${clientId})`
    );

    const payload = buildMqttMintPayload({
        brokerUrl,
        clientId,
        token,
        username: mintedUsername ?? username
    });

    return json(createSuccessResponse(payload));
}

/********************************************************************************************
 * Factory MQTT mint endpoint.
 *
 * Flow:
 * - Verifies the incoming factory JWT and extracts hardware/metadata claims.
 * - Upserts or creates a factoryDevice record with tracking metadata (IP, user-agent, timestamps).
 * - Delegates to mintFactoryMqttCredentials to obtain IoT Core–backed MQTT credentials.
 * - Returns a standardized response or appropriate error status.
 ********************************************************************************************/
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
        return await mintFactoryMqttCredentials(factoryDevice.id);
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
