import { getMqttTransport } from '../core/transport.js';
import jwt, { type Algorithm, type JwtPayload, type SignOptions, type Secret } from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { PrismaClient, JwtSigningKey } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { MQTT_NOTIFICATION_ISSUER, MQTT_NOTIFICATION_AUDIENCE } from '../constants.js';
import type { NotificationTicketEnvelope } from './envelope.js';

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

export const NotificationType = {
    REPLY: 'reply',
} as const;


export type DeviceNotificationType = (typeof DeviceNotificationType)[keyof typeof DeviceNotificationType];

export interface FactoryDeviceNotificationTicketParams {
    prisma: PrismaClient;
    factoryDeviceId: string;
    sub: string;
    type: DeviceNotificationType | string;
    expiresIn?: string;
    requestId?: string;
    payload?: Record<string, unknown>;
}

export interface NotificationTicketParams {
    prisma: PrismaClient;
    sub: string;
    recipient: string;
    type: DeviceNotificationType | string;
    expiresIn?: string | number;
    flowId: string;
    params?: Record<string, unknown>;
}

/********************************************************************************************
 * 
 * Convenice Functions
 * 
 ********************************************************************************************/
function convertExpiresIn(value: string | number): number {
    if (typeof value === 'number') {
        return value;
    }

    const match = value.match(/^(\d+(?:\.\d+)?)([smhd])?$/i);
    if (!match) {
        throw new Error(`Unable to parse expiresIn value: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2]?.toLowerCase();
    const multipliers: Record<string, number> = {
        s: 1,
        m: 60,
        h: 3600,
        d: 86400
    };

    return amount * (unit && multipliers[unit] ? multipliers[unit] : 1);
}

/********************************************************************************************
 * 
 * Standard Create ticket Function
 * 
 ********************************************************************************************/
export async function createTicket(prisma: PrismaClient, sub: string, recipient: string, type: string, flowId: string, params: Record<string, unknown>, expiresIn: string | number){
    const ticketPayload = {
        type,
        sub,
        recipient,
        flowId,
        params
    };
    const ticket = signTicket(prisma,ticketPayload, expiresIn);
    return ticket;
}

/********************************************************************************************
 * 
 * Sign Ticket
 * 
 ********************************************************************************************/
async function signTicket(prisma: PrismaClient, payload: Record<string, unknown>, expiresIn: string | number){
    const signingKey = await getNotificationSigningKey(prisma);
    const algorithm = (signingKey.algorithm ?? 'HS256') as Algorithm;
 
    if (!signingKey.privateKey) {
        throw new Error('Missing private key for signing notifications');
    }
    const signOptions: SignOptions = {
        algorithm,
        expiresIn: convertExpiresIn(expiresIn),
        issuer: MQTT_NOTIFICATION_ISSUER,
        audience: MQTT_NOTIFICATION_AUDIENCE,
        keyid: signingKey.id
    };

    const ticket = jwt.sign(payload, signingKey.privateKey as Secret, signOptions);

    return ticket;

}

/********************************************************************************************
 * 
 * Send Notification With Ticket
 * 
 ********************************************************************************************/
export async function sendNotificationWithTicket({
    prisma,
    sub,
    recipient,
    type,
    expiresIn = '5m',
    flowId,
    params
}: NotificationTicketParams): Promise<void> {
    
    if (!flowId) {
        throw new Error('flowId is required for notification tickets');
    }

    const effectiveParams = params ?? {};

    const ticket = await createTicket(
        prisma,
        sub,
        recipient,
        type,
        flowId,
        effectiveParams,
        expiresIn
    );

    let prefix = recipient.split(":")[0];

    if(prefix === 'factory'){
        prefix = 'device';
    }
        
    

    const topic = `${prefix}/${recipient}/notifications`;
    const transport = getMqttTransport();
    const message: Record<string, unknown> = { ticket };

    logger.info(`[MQTT Notification] Publishing notification to ${topic}: ${JSON.stringify(message)}`);

    try {
        await transport.publish(topic, JSON.stringify(message), { qos: 1 });
    } catch (err) {
        logger.error('[MQTT Notification] Failed to publish notification', {
            topic,
            error: err instanceof Error ? err.message : String(err)
        });
        throw err instanceof Error ? err : new Error(String(err));
    }
}

/********************************************************************************************
 * 
 * Validate and Extract Claims
 * 
 ********************************************************************************************/
export async function validateAndExtractClaims(
    prisma: PrismaClient,
    ticket: string
): Promise<JwtPayload> {
    const signingKey = await getNotificationSigningKey(prisma);
    const algorithm = (signingKey.algorithm ?? 'HS256') as Algorithm;
    const decoded = jwt.verify(ticket, signingKey.publicKey, {
        algorithms: [algorithm],
        issuer: MQTT_NOTIFICATION_ISSUER,
        audience: MQTT_NOTIFICATION_AUDIENCE
    });

    if (typeof decoded === 'string') {
        // We expect structured JWT payloads for notification tickets
        throw new Error('Unexpected string JWT payload for notification ticket');
    }

    return decoded;
}

/********************************************************************************************
 * 
 * Decode Notification Ticket
 * 
 ********************************************************************************************/
export async function decodeNotificationTicket(
    prisma: PrismaClient,
    ticket: string
): Promise<NotificationTicketEnvelope> {
    
    if (!ticket) {
        throw new Error('Missing ticket');
    }

    const claims = await validateAndExtractClaims(prisma, ticket);

    const decoded: NotificationTicketEnvelope = {
        sub: claims.sub,
        recipient: claims.recipient,
        type: claims.type,
        flowId: claims.flowId,
        params: claims.params
    };

    return decoded;
}


export async function sendFactoryDeviceNotificationWithTicket({
    prisma,
    factoryDeviceId,
    sub,
    type,
    expiresIn = '5m',
    requestId,
    payload
}: FactoryDeviceNotificationTicketParams): Promise<string> {
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

export interface DeviceNotificationTicketParams {
    prisma: PrismaClient;
    deviceId: string;
    sub: string;
    type: string;
    expiresIn?: string;
    requestId?: string;
    payload?: Record<string, unknown>;
}

export async function sendDeviceNotificationWithTicket({
    prisma,
    deviceId,
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
        deviceId,
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

    const topic = `device/device:${deviceId}/notifications`;
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
    factoryDeviceId?: string;
    deviceId?: string;
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
