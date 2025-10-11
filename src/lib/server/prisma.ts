import { enhance } from '@zenstackhq/runtime';
import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment';
import { logger } from './logger';

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

// Convenience function to get a \"sudo\" (system/root) enhanced Prisma client
export function getAdminPrisma() {
    return getEnhancedPrisma(
        {
            id: 'system',
            systemRole: 'ADMIN', // Or use your SystemRole.SUDO if you have an enum
        }
    );
}

// Create enhanced client with user context
export function getEnhancedPrisma(user?: {
    id: string;
    systemRole: string;
    accountMemberships?: any[]
} | null, options?: { logPrismaQuery?: boolean }) {
    console.log('[getEnhancedPrisma] START - Received user:', { 
        hasUser: !!user, 
        userId: user?.id, 
        systemRole: user?.systemRole,
        membershipCount: user?.accountMemberships?.length || 0
    });

    if (!user?.id) {
        console.log('[getEnhancedPrisma] No user ID, returning unenhanced client');
        return prisma;
    }

    const key = user.id;

    if (dev && global.enhancedClients?.has(key) && !options?.logPrismaQuery) {
        console.log('[getEnhancedPrisma] Returning cached enhanced client for user:', key);
        return global.enhancedClients.get(key)!;
    }

    console.log('[getEnhancedPrisma] Creating new enhanced client for user:', key);

    // Prepare the user context for Zenstack access policies
    // This is crucial for proper policy evaluation

    // Extract account IDs and roles from memberships if needed
    const membershipMap: Record<string, string> = {};
    if (user.accountMemberships && user.accountMemberships.length > 0) {
        console.log('[getEnhancedPrisma] Processing account memberships:', user.accountMemberships.length);
        user.accountMemberships.forEach((membership: any) => {
            if (membership.accountId && membership.role) {
                membershipMap[membership.accountId] = membership.role;
            } else if (membership.account?.id && membership.role) {
                membershipMap[membership.account.id] = membership.role;
            }
        });
        console.log('[getEnhancedPrisma] Membership map:', membershipMap);
    }

    // Create the user context in the format Zenstack expects
    // This needs to match the fields used in access policies
    const userContext = {
        id: user.id,
        systemRole: user.systemRole || 'USER',
        // Include account memberships for access policies
        accountMemberships: user.accountMemberships || []
    };

    console.log('[getEnhancedPrisma] User context created:', { 
        userId: userContext.id, 
        systemRole: userContext.systemRole,
        membershipCount: userContext.accountMemberships.length
    });

    try {
        // Create the enhanced client with the proper user context and options
        const enhanceOptions = options?.logPrismaQuery ? { logPrismaQuery: true } : undefined;
        console.log('[getEnhancedPrisma] Calling enhance() with options:', enhanceOptions);
        
        const enhanced = enhance(prisma, { user: userContext }, enhanceOptions);
        
        console.log('[getEnhancedPrisma] Enhanced client created successfully');

        // Add the user context directly to the enhanced client for debugging
        (enhanced as any).$user = userContext;

        // Log the enhanced client properties in development mode
        if (dev) {
            console.log('[getEnhancedPrisma] Enhanced client properties:', { 
                hasResourceCreate: typeof enhanced.resource?.create === 'function',
                hasDevice: !!enhanced.device,
                hasDeviceFindUnique: typeof enhanced.device?.findUnique === 'function'
            });
        }

        if (dev) {
            global.enhancedClients?.set(key, enhanced);
            console.log('[getEnhancedPrisma] Cached enhanced client for user:', key);
        }

        console.log('[getEnhancedPrisma] END - Returning enhanced client');
        return enhanced;
    } catch (e) {
        console.error('[getEnhancedPrisma] ERROR creating enhanced client:', {
            error: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
            userId: user.id,
            systemRole: user.systemRole
        });
        throw e;
    }
}

export default prisma;
