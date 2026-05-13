import { enhance } from '@zenstackhq/runtime';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { initializeActionLogHooks } from './db/hooks/actionLogHooks';

const dev = process.env.NODE_ENV !== 'production';

declare global {
    var prisma: PrismaClient | undefined;
    var enhancedClients: Map<string, PrismaClient> | undefined;
}

if (dev) {
    if (!global.enhancedClients) {
        global.enhancedClients = new Map();
    }
}

const prisma = global.prisma || new PrismaClient();

if (dev) {
    global.prisma = prisma;
}

initializeActionLogHooks(prisma);

export function getAdminPrisma() {
    return getEnhancedPrisma(
        {
            id: 'system',
            systemRole: 'ADMIN',
        }
    );
}

export function getEnhancedPrisma(user?: {
    id: string;
    systemRole: string;
    accountMemberships?: any[]
} | null, options?: { logPrismaQuery?: boolean }) {
    if (!user?.id) {
        return prisma;
    }

    const key = user.id;

    if (dev && global.enhancedClients?.has(key) && !options?.logPrismaQuery) {
        return global.enhancedClients.get(key)!;
    }

    const membershipMap: Record<string, string> = {};
    if (user.accountMemberships && user.accountMemberships.length > 0) {
        user.accountMemberships.forEach((membership: any) => {
            if (membership.accountId && membership.role) {
                membershipMap[membership.accountId] = membership.role;
            } else if (membership.account?.id && membership.role) {
                membershipMap[membership.account.id] = membership.role;
            }
        });
    }

    const userContext = {
        id: user.id,
        systemRole: user.systemRole || 'USER',
        accountMemberships: user.accountMemberships || []
    };

    try {
        const enhanceOptions = options?.logPrismaQuery ? { logPrismaQuery: true } : undefined;
        const enhanced = enhance(prisma, { user: userContext }, enhanceOptions);
        (enhanced as any).$user = userContext;

        if (dev) {
            global.enhancedClients?.set(key, enhanced);
        }

        return enhanced;
    } catch (e) {
        logger.error('[getEnhancedPrisma] Failed to create enhanced client', {
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
            userId: user.id,
            systemRole: user.systemRole
        });
        throw e;
    }
}

export default prisma;
