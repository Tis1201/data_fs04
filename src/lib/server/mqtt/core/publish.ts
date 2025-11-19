import { getMqttTransport } from '../core/transport.js';
import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { PrismaClient, JwtSigningKey } from '@prisma/client';

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
}

export async function publishEnvelope(topic: string, envelope: PublishEnvelope): Promise<void> {
    const transport = getMqttTransport();
    await transport.publish(topic, JSON.stringify(envelope));
}

export interface DeviceNotificationTicketParams {
    prisma: PrismaClient;
    factoryDeviceId: string;
    sub: string;
    type: string;
    expiresIn?: string;
}

export async function sendDeviceNotificationWithTicket({
    prisma,
    factoryDeviceId,
    sub,
    type,
    expiresIn = '5m'
}: DeviceNotificationTicketParams): Promise<void> {
    const signingKey = await getNotificationSigningKey(prisma);

    const algorithm = (signingKey.algorithm ?? 'HS256') as Algorithm;
    const ticketPayload = {
        type,
        factoryDeviceId,
        sub,
        requestId: crypto.randomUUID()
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
    await transport.publish(topic, JSON.stringify({ ticket }), { qos: 1 });
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
