import type { PrismaClient } from '@prisma/client';

interface DeviceAccessResult {
    deviceId: string;
    isOwner: boolean;
    isAccountMember: boolean;
}

export async function checkDeviceAccess({
    prisma,
    sub,
    deviceId
}: {
    prisma: PrismaClient;
    sub: string | null;
    deviceId?: string;
}): Promise<DeviceAccessResult> {
    const normalizedDeviceId = deviceId?.trim();

    if (!normalizedDeviceId) {
        throw new Error('deviceId is required');
    }

    if (!sub) {
        throw new Error('Missing subject for web client');
    }

    const [subjectType, userId, accountId] = sub.split(':');

    if (subjectType !== 'user' || !userId) {
        throw new Error('Invalid subject for web client');
    }

    const device = await prisma.device.findUnique({
        where: { id: normalizedDeviceId },
        select: {
            id: true,
            createdBy: true,
            accountId: true,
            account: {
                select: {
                    members: {
                        select: { userId: true }
                    }
                }
            }
        }
    });

    if (!device) {
        throw new Error('Device not found');
    }

    // Skip owner/account check for admin users
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { systemRole: true }
    });
    if (user?.systemRole === 'ADMIN' || user?.systemRole === 'SUPER_ADMIN') {
        return { deviceId: device.id, isOwner: false, isAccountMember: true };
    }

    const isOwner = device.createdBy === userId;

    const isAccountMember = Boolean(
        device.accountId &&
            accountId &&
            device.account?.members?.some((m) => m.userId === userId)
    );

    if (!isOwner && !isAccountMember) {
        throw new Error('Access denied to this device');
    }

    return { deviceId: device.id, isOwner, isAccountMember };

}