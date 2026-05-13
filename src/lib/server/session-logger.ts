import { logger } from '$lib/server/logger';
import type { PrismaClient } from '@prisma/client';

/**
 * Log a user session activity
 * @param prisma Prisma client instance
 * @param data Session log data
 */
export async function logSessionActivity(
    prisma: PrismaClient,
    data: {
        userId: string;
        action: 'login' | 'logout' | 'timeout' | 'revoked';
        sessionId?: string;
        ipAddress?: string;
        userAgent?: string;
        deviceInfo?: Record<string, any>;
        accountId?: string;
    }
) {
    try {
        // Create the session log
        await prisma.userSessionLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                sessionId: data.sessionId,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                deviceInfo: data.deviceInfo ? JSON.stringify(data.deviceInfo) : undefined,
                accountId: data.accountId
            }
        });

        logger.debug('Session activity logged', { 
            userId: data.userId, 
            action: data.action,
            sessionId: data.sessionId
        });
    } catch (error) {
        // Log the error but don't throw - session logging should not block the main flow
        logger.error('Failed to log session activity', { 
            error, 
            userId: data.userId,
            action: data.action
        });
    }
}

/**
 * Log a failed login attempt
 * @param prisma Prisma client instance
 * @param data Failed login data
 */
export async function logFailedLogin(
    prisma: PrismaClient,
    data: {
        email: string;
        reason: string;
        ipAddress?: string;
        userAgent?: string;
        accountId?: string;
    }
) {
    try {
        // Create the failed login log
        await prisma.failedLoginLog.create({
            data: {
                email: data.email,
                reason: data.reason,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                accountId: data.accountId
            }
        });

        logger.debug('Failed login logged', { 
            email: data.email, 
            reason: data.reason 
        });
    } catch (error) {
        // Log the error but don't throw
        logger.error('Failed to log failed login', { 
            error, 
            email: data.email,
            reason: data.reason
        });
    }
}
