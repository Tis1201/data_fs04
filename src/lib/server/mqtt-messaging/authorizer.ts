import type { UserInfo } from '$lib/server/types/user';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { logger } from '$lib/server/logger';

export class UnauthorizedMqttAccessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedMqttAccessError';
    }
}

function normalizeMemberships(user: UserInfo): any[] | undefined {
    return user.memberships?.map((membership) => ({
        accountId: membership.account.id,
        role: (membership as any).role,
        account: membership.account
    }));
}

export async function assertDeviceAccess(user: UserInfo, deviceId: string): Promise<void> {
    if (!deviceId) {
        throw new UnauthorizedMqttAccessError('Device ID is required');
    }

    if (!user?.id) {
        throw new UnauthorizedMqttAccessError('Authenticated user is required');
    }

    if (user.systemRole === 'ADMIN') {
        return;
    }

    const prisma = getEnhancedPrisma({
        id: user.id,
        systemRole: user.systemRole,
        accountMemberships: normalizeMemberships(user)
    });

    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: { id: true }
        });

        if (!device) {
            throw new UnauthorizedMqttAccessError('User is not authorized to address this device');
        }
    } catch (error) {
        if (error instanceof UnauthorizedMqttAccessError) {
            throw error;
        }

        logger.error('[MQTT Authorizer] Failed device access check', {
            userId: user.id,
            deviceId,
            error: error instanceof Error ? error.message : String(error)
        });

        throw new UnauthorizedMqttAccessError('Unable to verify device access');
    }
}
