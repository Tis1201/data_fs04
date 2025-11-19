import { getMqttTransport } from '../core/transport.js';
import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { PrismaClient, JwtSigningKey } from '@prisma/client';
import { logger } from '$lib/server/logger';

const SIGNING_KEY_CACHE_TTL_MS = 60_000;

let cachedSigningKey: { key: JwtSigningKey; expiresAt: number } | null = null;

async function getNotificationSigningKey(prisma: PrismaClient): Promise<JwtSigningKey> {
    const now = Date.now();
    if (cachedSigningKey && cachedSigningKey.expiresAt > now) {
        return cachedSigningKey.key;
    }

    const signingKey = await prisma.jwtSigningKey.findFirst({
        where: {
            keyType: 'LINK',
            isPrimary: true,
            isActive: true
        }
    });

    if (!signingKey) {
        throw new Error('Unable to generate notification ticket: missing signing key');
    }

    cachedSigningKey = {
        key: signingKey,
        expiresAt: now + SIGNING_KEY_CACHE_TTL_MS
    };

    return signingKey;
}

export interface PublishEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
    eventId: string;
    payload: TPayload;
    correlationId?: string;
    source?: string;
    type?: string;
}

export const NotificationEventType = {
    ClaimConfirmed: 'claim.confirmed',
} as const;

export type NotificationEventType = (typeof NotificationEventType)[keyof typeof NotificationEventType];

export async function publishEnvelope(topic: string, envelope: PublishEnvelope): Promise<void> {
    const transport = getMqttTransport();
    await transport.publish(topic, JSON.stringify(envelope));
}

export const DeviceNotificationType = {
    Claim: 'claim',
} as const;

export type DeviceNotificationType = (typeof DeviceNotificationType)[keyof typeof DeviceNotificationType];

export interface DeviceNotificationTicketParams {
    prisma: PrismaClient;
    factoryDeviceId: string;
    sub: string;
    type: DeviceNotificationType | string;
    expiresIn?: string;
    requestId?: string;
    payload?: Record<string, unknown>;
}

export async function sendDeviceNotificationWithTicket({
    prisma,
    factoryDeviceId,
    sub,
    type,
    expiresIn = '5m',
    requestId,
    payload
}: DeviceNotificationTicketParams): Promise<string> {
    const signingKey = await getNotificationSigningKey(prisma);

    const algorithm = (signingKey.algorithm ?? 'HS256') as Algorithm;
    const effectiveRequestId = requestId ?? crypto.randomUUID();
    const ticketPayload = {
        type,
        factoryDeviceId,
        sub,
        requestId: effectiveRequestId
    };

    const ticket = jwt.sign(ticketPayload, signingKey.privateKey, {
        algorithm,
        expiresIn,
        issuer: 'fs04',
        audience: 'fs04:device-notification',
        keyid: signingKey.id
    });

    const topic = `device/factory:${factoryDeviceId}/notifications`;
    const transport = getMqttTransport();
    const message: Record<string, unknown> = { ticket };
    if (payload && Object.keys(payload).length > 0) {
        message.payload = payload;
    }
    try {
        await transport.publish(topic, JSON.stringify(message), { qos: 1 });
    } catch (err) {
        logger.error('[MQTT Notification] Failed to publish device notification', {
            topic,
            error: err instanceof Error ? err.message : String(err)
        });
        throw err instanceof Error ? err : new Error(String(err));
    }

    return effectiveRequestId;
}

export interface VerifiedDeviceNotificationTicket extends JwtPayload {
    type: string;
    factoryDeviceId: string;
    sub: string;
    requestId: string;
}

export async function verifyDeviceNotificationTicket(params: {
    prisma: PrismaClient;
    ticket: string;
    expectedType?: string;
    expectedFactoryDeviceId?: string;
}): Promise<VerifiedDeviceNotificationTicket> {
    const { prisma, ticket, expectedType, expectedFactoryDeviceId } = params;
    const signingKey = await getNotificationSigningKey(prisma);
    const algorithm = (signingKey.algorithm ?? 'HS256') as Algorithm;
    const verifyKey = algorithm.startsWith('RS') ? signingKey.publicKey : signingKey.privateKey;

    let decoded: JwtPayload;
    try {
        decoded = jwt.verify(ticket, verifyKey, {
            algorithms: [algorithm],
            issuer: 'fs04',
            audience: 'fs04:device-notification'
        }) as JwtPayload;
    } catch (err) {
        throw new Error('Invalid or expired ticket');
    }

    if (expectedType && decoded.type !== expectedType) {
        throw new Error('Invalid ticket type');
    }

    if (expectedFactoryDeviceId && decoded.factoryDeviceId !== expectedFactoryDeviceId) {
        throw new Error('Ticket factoryDeviceId mismatch');
    }

    return decoded as VerifiedDeviceNotificationTicket;
}

export interface UserNotificationTicketParams {
    sub: string;
    type: NotificationEventType | string;
    requestId?: string;
    payload?: Record<string, unknown>;
}

export async function sendUserNotificationWithTicket({
    sub,
    type,
    requestId,
    payload
}: UserNotificationTicketParams): Promise<string> {
    const effectiveRequestId = requestId ?? crypto.randomUUID();

    await publishEnvelope(`user/${sub}/notifications`, {
        eventId: effectiveRequestId,
        type,
        payload: {
            requestId: effectiveRequestId,
            ...(payload ?? {})
        },
        source: typeof type === 'string' ? type : 'user.notification'
    });

    return effectiveRequestId;
}
