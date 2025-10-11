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
    if (!user?.id) {
        // Return unenhanced client for anonymous access
        return prisma;
    }
    
    const key = user.id;
    
    if (dev && global.enhancedClients?.has(key) && !options?.logPrismaQuery) {
        return global.enhancedClients.get(key)!;
    }

    // Prepare the user context for Zenstack access policies
    // This is crucial for proper policy evaluation
    
    // Extract account IDs and roles from memberships if needed
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
    
    // Create the user context in the format Zenstack expects
    // This needs to match the fields used in access policies
    const userContext = {
        id: user.id,
        systemRole: user.systemRole || 'USER',
        // Include account memberships for access policies
        accountMemberships: user.accountMemberships || []
    };
    
    logger.debug('Enhancing Prisma client with user context:', { userId: userContext.id, systemRole: userContext.systemRole });

    // Create the enhanced client with the proper user context and options
    const enhanceOptions = options?.logPrismaQuery ? { logPrismaQuery: true } : undefined;
    const enhanced = enhance(prisma, { user: userContext }, enhanceOptions);
    
    // Add the user context directly to the enhanced client for debugging
    (enhanced as any).$user = userContext;
    
    // Log the enhanced client properties in development mode
    if (dev) {
        logger.debug('Enhanced client has resource.create:', { hasResourceCreate: typeof enhanced.resource?.create === 'function' });
    }

    if (dev) {
        global.enhancedClients?.set(key, enhanced);
    }

    return enhanced;
}

export default prisma;
