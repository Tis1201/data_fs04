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
export function getEnhancedPrisma(user?: { 
    id: string; 
    systemRole: string;
    accountMemberships?: any[] 
} | null) {
    if (!user?.id) {
        // Return unenhanced client for anonymous access
        return prisma;
    }
    
    const key = user.id;
    
    if (dev && global.enhancedClients?.has(key)) {
        return global.enhancedClients.get(key)!;
    }

    // The issue is that Zenstack expects a specific format for the user context
    // We need to flatten the accountMemberships array into a format that Zenstack can use
    
    // Extract account IDs and roles from memberships for easier access policy checks
    const membershipMap = {};
    if (user.accountMemberships && user.accountMemberships.length > 0) {
        user.accountMemberships.forEach(membership => {
            if (membership.accountId && membership.role) {
                membershipMap[membership.accountId] = membership.role;
            }
        });
    }
    
    // Create the user context in the format Zenstack expects
    const userContext = {
        id: user.id,
        systemRole: user.systemRole || 'USER',
        // Include account memberships for access policies
        accountMemberships: user.accountMemberships || [],
        // Add a flattened map of account IDs to roles for easier policy checks
        membershipMap: membershipMap
    };
    
    console.log('Enhancing Prisma client with user context:', JSON.stringify(userContext, null, 2));

    // Create the enhanced client with the proper user context
    const enhanced = enhance(prisma, { user: userContext });
    
    // Add the user context directly to the enhanced client for debugging
    (enhanced as any).$user = userContext;
    
    // Log the enhanced client properties
    console.log('Enhanced Prisma client properties:', Object.keys(enhanced));
    
    // Check if the enhanced client has the expected methods
    console.log('Enhanced client has resource.create:', typeof enhanced.resource?.create === 'function');

    if (dev) {
        global.enhancedClients?.set(key, enhanced);
    }

    return enhanced;
}

export default prisma;
