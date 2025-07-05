import { getEnhancedPrisma } from '$lib/server/prisma';
import type { PrismaClient } from '@prisma/client';

interface UserContext {
    id: string;
    systemRole: string;
    accountMemberships?: any[];
}

export function getAdminPrisma(user: UserContext, memberships?: any[]): PrismaClient {
    return getEnhancedPrisma({
        id: user.id,
        systemRole: 'ADMIN',
        accountMemberships: memberships || []
    });
}

export function getAdminPrismaFromAuth(auth: any, memberships?: any[]): PrismaClient {
    if (!auth?.user) {
        throw new Error('Authentication required for admin Prisma client');
    }
    
    const adminUser = {
        id: auth.user.id,
        systemRole: 'ADMIN'
    };
    
    // Force cache bypass by adding a timestamp to the user ID
    const cacheKey = `${adminUser.id}_${Date.now()}`;
    const adminUserWithCacheKey = {
        ...adminUser,
        id: cacheKey
    };
    
    return getAdminPrisma(adminUserWithCacheKey, memberships);
}
