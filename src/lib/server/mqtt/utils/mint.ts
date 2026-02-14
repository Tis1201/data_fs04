import jwt, { type Algorithm } from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { getAdminPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

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

export interface MqttMintPayload {
    brokerUrl: string;
    clientId: string;
    username: string;
    jwt: string;
    mqttUsername?: string;
}

export function getMqttBrokerUrl(): string | null {
    return process.env.MQTT_BROKER_URL ?? null;
}

/**
 * Get the WebSocket URL for browser MQTT clients.
 * Falls back to converting MQTT_BROKER_URL from mqtt:// to ws:// with port 8083.
 */
export function getMqttBrokerWsUrl(): string | null {
    return process.env.MQTT_BROKER_URL_EXTERNAL || null;
}

/**
 * Build a standardized MQTT mint payload used by all mint endpoints.
 *
 * - Ensures consistent shape across factory/user/device responses.
 * - Optionally includes legacy `mqttUsername` for backward compatibility
 *   (used by the Python ClaimedDevice client and older tests).
 */
export function buildMqttMintPayload(args: {
    brokerUrl: string;
    clientId: string;
    token: string;
    username: string;
    includeLegacyMqttUsername?: boolean;
}): MqttMintPayload {
    const base: MqttMintPayload = {
        brokerUrl: args.brokerUrl,
        clientId: args.clientId,
        username: args.username,
        jwt: args.token
    };

    if (args.includeLegacyMqttUsername) {
        return {
            ...base,
            mqttUsername: args.username
        };
    }

    return base;
}

type JwtSigningKeyClient = Pick<PrismaClient, 'jwtSigningKey'>;

/**
 * Helper for minting MQTT credentials for EMQX using a locally signed JWT.
 *
 * Uses the primary LINK signing key from fs04_web's jwtSigningKey table to
 * sign a short-lived JWT that includes EMQX-compatible ACL claims derived
 * from pubTopics/subTopics. Returns null on any error so callers can decide
 * how to respond (fallback, 5xx, etc.).
 */
export async function mintIoTCoreCredentials(
    params: IoTCoreMintParams,
    prismaOverride?: JwtSigningKeyClient
): Promise<IoTCoreMintResult | null> {
    try {
        const prisma = prismaOverride ?? getAdminPrisma();
        const linkKey = await prisma.jwtSigningKey.findFirst({
            where: {
                keyType: 'LINK',
                isActive: true,
                isPrimary: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (!linkKey) {
            logger.error('[MqttMint] No active primary LINK signing key found');
            return null;
        }

        const randomSuffix = randomBytes(3).toString('hex');
        const clientId = `${params.username}_${randomSuffix}`;

        // JWT payload compatible with EMQX JWT + ACL (old ACL format)
        const payload = {
            sub: params.username,
            client_id: clientId,
            username: params.username,
            pub: params.pubTopics,
            sub_topics: params.subTopics,
            acl: {
                pub: params.pubTopics,
                sub: params.subTopics
            }
        };

        const algorithm: Algorithm = (linkKey.algorithm || 'RS256') as Algorithm;

        const token = jwt.sign(payload, linkKey.privateKey, {
            algorithm,
            expiresIn: '24h',
            keyid: linkKey.id  // Must match JWKS endpoint which uses `id` (cuid) not `keyId`
        });

        return {
            clientId,
            token,
            username: params.username,
            accountId: undefined
        };
    } catch (err) {
        logger.error(
            `[MqttMint] Error generating EMQX JWT credentials: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
    }
}
