import type { PrismaClient, User, Account, FactoryDevice } from '@prisma/client';
import { verifyDeviceNotificationTicket, type VerifiedDeviceNotificationTicket } from './publish';

export interface DeviceClaimContext {
    ticket: VerifiedDeviceNotificationTicket;
    user: User;
    account: Account | null;
    factoryDevice: FactoryDevice;
}

export async function resolveDeviceClaimContextFromTicket(params: {
    prisma: PrismaClient;
    ticket: string;
    topic: string;
}): Promise<DeviceClaimContext> {
    const { prisma, ticket, topic } = params;

    // Extract factoryDeviceId from topic: device/factory:<id>/requests
    const parts = topic.split('/');
    const subPart = parts[1] ?? '';
    const factoryDeviceIdFromTopic = subPart.startsWith('factory:')
        ? subPart.replace('factory:', '')
        : '';

    if (!factoryDeviceIdFromTopic) {
        throw new Error('Invalid factory device topic');
    }

    const verified = await verifyDeviceNotificationTicket({
        prisma,
        ticket,
        expectedType: 'claim',
        expectedFactoryDeviceId: factoryDeviceIdFromTopic
    });

    const subject = verified.sub;
    if (!subject || !subject.startsWith('user:')) {
        throw new Error('Invalid ticket subject');
    }

    const [, userId, accountId] = subject.split(':');
    if (!userId) {
        throw new Error('Missing user id in ticket subject');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error('User for claim ticket not found');
    }

    let account: Account | null = null;
    if (accountId) {
        account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) {
            throw new Error('Account for claim ticket not found');
        }
    }

    const factoryDevice = await prisma.factoryDevice.findUnique({
        where: { id: verified.factoryDeviceId }
    });

    if (!factoryDevice) {
        throw new Error('Factory device for claim ticket not found');
    }

    if (account && factoryDevice.accountId && factoryDevice.accountId !== account.id) {
        throw new Error('Ticket account does not match factory device account');
    }

    return { ticket: verified, user, account, factoryDevice };
}
