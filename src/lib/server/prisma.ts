import { enhance } from '@zenstackhq/runtime';
import { PrismaClient } from '@prisma/client';
import { dev } from '$app/environment';

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

// Create enhanced client with user context
export function getEnhancedPrisma(user?: { id: string; rolesString: string } | null) {
    if (!user?.id) {
        // Return unenhanced client for anonymous access
        return prisma;
    }
    
    const key = user.id;
    
    if (dev && global.enhancedClients?.has(key)) {
        return global.enhancedClients.get(key)!;
    }

    const enhanced = enhance(prisma, {
        user: {
            id: user.id,
            rolesString: user.rolesString
        }
    });

    if (dev) {
        global.enhancedClients?.set(key, enhanced);
    }

    return enhanced;
}

export default prisma;
