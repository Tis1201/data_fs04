import { logger } from '../logger';

export interface IoTCoreMintParams {
    username: string;
    pubTopics: string[];
    subTopics: string[];
}

export interface IoTCoreMintResult {
    clientId: string;
    token: string;
    username?: string;
    accountId?: string;
}

export function getMqttBrokerUrl(): string | null {
    return process.env.MQTT_BROKER_URL ?? null;
}

/**
 * Helper for minting MQTT credentials from fs04_iot_core `/api/mq/mint`.
 *
 * Uses IOT_CORE_BASE_URL and IOT_CORE_API_KEY from process.env. Returns null
 * on any configuration or HTTP error so callers can decide how to respond
 * (fallback, 5xx, etc.).
 */
export async function mintIoTCoreCredentials(
    params: IoTCoreMintParams
): Promise<IoTCoreMintResult | null> {
    const iotCoreBaseUrl = process.env.IOT_CORE_BASE_URL;
    const iotCoreApiKey = process.env.IOT_CORE_API_KEY;

    if (!iotCoreBaseUrl || !iotCoreApiKey) {
        logger.error('[IoTCoreMint] IOT_CORE_BASE_URL or IOT_CORE_API_KEY is not configured');
        return null;
    }

    const mintUrl = `${iotCoreBaseUrl.replace(/\/+$/, '')}/api/mq/mint`;

    try {
        const res = await fetch(mintUrl, {
            method: 'POST',
            headers: {
                'x-api-key': iotCoreApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: params.username,
                pub_topics: params.pubTopics,
                sub_topics: params.subTopics
            })
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            logger.error(
                `[IoTCoreMint] /api/mq/mint failed for ${params.username} with status ${res.status}: ${text}`
            );
            return null;
        }

        const data = (await res.json()) as {
            clientId: string;
            token: string;
            username?: string;
            accountId?: string;
        };

        if (!data.clientId || !data.token) {
            logger.error('[IoTCoreMint] Mint response missing clientId or token');
            return null;
        }

        return {
            clientId: data.clientId,
            token: data.token,
            username: data.username,
            accountId: data.accountId
        };
    } catch (err) {
        logger.error(
            `[IoTCoreMint] Error calling /api/mq/mint: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
    }
}
