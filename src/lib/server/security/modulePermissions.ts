/**
 * Module Permissions Service
 * 
 * Core service for checking and managing module-level permissions.
 * Handles group permissions, user overrides, and caching.
 */

import type { PrismaClient } from '@prisma/client';
import prisma from '$lib/server/prisma';
import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';
import type { PermissionAction } from '$lib/constants/permissions';
import { SYSTEM_ACCOUNT } from '$lib/constants/system';

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300;
const CACHE_PREFIX = 'module_permissions:';

/**
 * Type for module permissions map
 * Key: module name, Value: array of allowed actions
 */
export type ModulePermissions = Record<string, PermissionAction[]>;

/**
 * Input type for creating/updating user permission overrides
 */
export interface UserPermissionOverrideInput {
    userId: string;
    accountId: string;
    module: string;
    action: PermissionAction;
    allowed: boolean;
    reason?: string;
    expiresAt?: Date;
    createdBy: string;
}

/**
 * Get cache key for user permissions
 */
function getCacheKey(userId: string, accountId: string): string {
    return `${CACHE_PREFIX}${userId}:${accountId}`;
}

/**
 * Invalidate permission cache for a user in an account
 */
export async function invalidatePermissionCache(userId: string, accountId: string): Promise<void> {
    if (!redis) return;
    
    try {
        const cacheKey = getCacheKey(userId, accountId);
        await redis.del(cacheKey);
        logger.debug('Permission cache invalidated', { userId, accountId });
    } catch (e) {
        logger.warn('Failed to invalidate permission cache', { error: e });
    }
}

/**
 * Get all module permissions for a user in an account
 * Combines group permissions with user overrides
 * 
 * @param userId - User ID
 * @param accountId - Account ID
 * @param prismaClient - Optional Prisma client (defaults to global instance)
 * @returns Map of module names to allowed actions
 */
export async function getUserModulePermissions(
    userId: string,
    accountId: string,
    prismaClient?: PrismaClient
): Promise<ModulePermissions> {
    const client = prismaClient || prisma;
    
    if (!client) {
        logger.error('No Prisma client available for getUserModulePermissions', { userId, accountId });
        // Fail closed: no permissions when DB client is unavailable
        return {};
    }
    
    const cacheKey = getCacheKey(userId, accountId);

    // Try cache first
    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached) as ModulePermissions;
                logger.debug('Permission cache hit', { userId, accountId });
                return parsed;
            }
        } catch (e) {
            logger.warn('Permission cache read failed', { error: e });
        }
    }

    // Fetch from database (fail-closed: on any error, return {})
    let membership: any = null;
    try {
        // 1. Get user's account membership
        // For SYSTEM_ACCOUNT, we need to check even if role is 'SYSTEM'
        membership = await client.accountMembership.findFirst({
            where: {
                userId,
                accountId
            },
            include: {
                account: {
                    select: { slug: true, isSystem: true }
                }
            }
        });
    } catch (e) {
        logger.error('Failed to query account membership for module permissions', {
            error: e,
            userId,
            accountId
        });
        return {};
    }

    if (!membership) {
        logger.debug('No account membership found', { userId, accountId });
        return {};
    }

    // SYSTEM_ACCOUNT members bypass all ACL checks - return all permissions
    // Check this BEFORE filtering by role, as SYSTEM_ACCOUNT memberships can have role 'SYSTEM'
    if (membership.account.slug === SYSTEM_ACCOUNT || membership.account.isSystem) {
        logger.debug('SYSTEM_ACCOUNT member - bypassing ACL, returning all permissions', { userId, accountId, role: membership.role });
        // Return a special marker that indicates "all permissions"
        // This will be handled by hasModulePermission to always return true
        return { __SYSTEM_ACCOUNT__: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] } as any;
    }

    // For non-SYSTEM accounts, filter out SYSTEM role memberships
    if (membership.role === 'SYSTEM') {
        logger.debug('Membership has SYSTEM role but account is not SYSTEM_ACCOUNT', { userId, accountId, role: membership.role });
        return {};
    }

    // 2. Get all groups the user belongs to in this account
    let groupMemberships: any[] = [];
    try {
        groupMemberships = await client.groupMembership.findMany({
            where: {
                membershipId: membership.id
            },
            include: {
                group: {
                    include: {
                        permissions: {
                            where: {
                                allowed: true
                            }
                        }
                    }
                }
            }
        });
    } catch (e) {
        logger.error('Failed to query group memberships for module permissions', {
            error: e,
            userId,
            accountId,
            membershipId: membership?.id
        });
        return {};
    }

    // 3. Aggregate permissions from all groups (union - OR logic)
    const groupPermissions: ModulePermissions = {};
    for (const gm of groupMemberships) {
        for (const perm of gm.group.permissions) {
            if (!groupPermissions[perm.module]) {
                groupPermissions[perm.module] = [];
            }
            if (!groupPermissions[perm.module].includes(perm.action as PermissionAction)) {
                groupPermissions[perm.module].push(perm.action as PermissionAction);
            }
        }
    }

    // 4. Get user-specific overrides
    const now = new Date();
    let overrides: any[] = [];
    try {
        const overrideModel = (client as any).userPermissionOverride;
        if (!overrideModel) {
            // Optional feature: some environments may not have this model in the generated Prisma client
            overrides = [];
        } else {
            overrides = await overrideModel.findMany({
            where: {
                userId,
                accountId,
                isActive: true,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
            }
            });
        }
    } catch (e) {
        logger.error('Failed to query user permission overrides', {
            error: e,
            userId,
            accountId
        });
        // Overrides are optional; continue with group permissions only
        overrides = [];
    }

    // 5. Apply overrides to group permissions
    const finalPermissions: ModulePermissions = { ...groupPermissions };

    for (const override of overrides) {
        const module = override.module;
        const action = override.action as PermissionAction;

        if (!finalPermissions[module]) {
            finalPermissions[module] = [];
        }

        if (override.allowed) {
            // Grant: add action if not already present
            if (!finalPermissions[module].includes(action)) {
                finalPermissions[module].push(action);
            }
        } else {
            // Deny: remove action from permissions
            finalPermissions[module] = finalPermissions[module].filter(a => a !== action);
            
            // Remove module entry if no actions left
            if (finalPermissions[module].length === 0) {
                delete finalPermissions[module];
            }
        }
    }

    // Cache result
    if (redis) {
        try {
            await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(finalPermissions));
        } catch (e) {
            logger.warn('Permission cache write failed', { error: e });
        }
    }

    return finalPermissions;
}

/**
 * Check if user has a specific module permission
 * 
 * @param params - Permission check parameters
 * @param params.userId - User ID
 * @param params.accountId - Account ID
 * @param params.module - Module name
 * @param params.action - Action to check
 * @param params.prismaClient - Optional Prisma client
 * @returns True if user has the permission
 */
export async function hasModulePermission(params: {
    userId: string;
    accountId: string;
    module: string;
    action: PermissionAction;
    prismaClient?: PrismaClient;
}): Promise<boolean> {
    const { userId, accountId, module, action, prismaClient } = params;
    
    const permissions = await getUserModulePermissions(userId, accountId, prismaClient);
    
    // SYSTEM_ACCOUNT members have all permissions
    if (permissions.__SYSTEM_ACCOUNT__) {
        return true;
    }
    
    const modulePerms = permissions[module];
    
    return modulePerms?.includes(action) || false;
}

/**
 * Upsert a user permission override
 * Creates or updates an override for a user
 * 
 * @param input - Override input data
 * @param prismaClient - Optional Prisma client
 * @returns Created/updated override
 */
export async function upsertUserPermissionOverride(
    input: UserPermissionOverrideInput,
    prismaClient?: PrismaClient
) {
    const client = prismaClient || prisma;
    
    const overrideModel = (client as any).userPermissionOverride;
    if (!overrideModel) {
        throw new Error('UserPermissionOverride model is not available in Prisma client (run prisma generate / update schema).');
    }

    const override = await overrideModel.upsert({
        where: {
            userId_accountId_module_action: {
                userId: input.userId,
                accountId: input.accountId,
                module: input.module,
                action: input.action
            }
        },
        update: {
            allowed: input.allowed,
            reason: input.reason,
            expiresAt: input.expiresAt,
            isActive: true,
            updatedAt: new Date()
        },
        create: {
            userId: input.userId,
            accountId: input.accountId,
            module: input.module,
            action: input.action,
            allowed: input.allowed,
            reason: input.reason,
            expiresAt: input.expiresAt,
            isActive: true,
            createdBy: input.createdBy
        }
    });

    // Invalidate cache
    await invalidatePermissionCache(input.userId, input.accountId);

    return override;
}

/**
 * Delete a user permission override
 * 
 * @param overrideId - Override ID to delete
 * @param deletedBy - User ID who deleted the override (for audit)
 * @param prismaClient - Optional Prisma client
 */
export async function deleteUserPermissionOverride(
    overrideId: string,
    deletedBy: string,
    prismaClient?: PrismaClient
): Promise<void> {
    const client = prismaClient || prisma;
    
    const overrideModel = (client as any).userPermissionOverride;
    if (!overrideModel) {
        throw new Error('UserPermissionOverride model is not available in Prisma client (run prisma generate / update schema).');
    }

    const override = await overrideModel.findUnique({
        where: { id: overrideId },
        select: { userId: true, accountId: true }
    });

    if (!override) {
        throw new Error('Override not found');
    }

    await overrideModel.delete({
        where: { id: overrideId }
    });

    // Invalidate cache
    await invalidatePermissionCache(override.userId, override.accountId);
}

/**
 * Bulk create user permission overrides
 * 
 * @param overrides - Array of override inputs
 * @param prismaClient - Optional Prisma client
 * @returns Number of overrides created
 */
export async function bulkCreateUserPermissionOverrides(
    overrides: UserPermissionOverrideInput[],
    prismaClient?: PrismaClient
): Promise<number> {
    if (overrides.length === 0) return 0;

    const client = prismaClient || prisma;
    const overrideModel = (client as any).userPermissionOverride;
    if (!overrideModel) {
        throw new Error('UserPermissionOverride model is not available in Prisma client (run prisma generate / update schema).');
    }
    
    // Group by userId+accountId to batch cache invalidation
    const accountKeys = new Set<string>();
    
    // Use transaction for atomicity
    const result = await client.$transaction(async (tx) => {
        let created = 0;
        
        for (const input of overrides) {
            await (tx as any).userPermissionOverride.upsert({
                where: {
                    userId_accountId_module_action: {
                        userId: input.userId,
                        accountId: input.accountId,
                        module: input.module,
                        action: input.action
                    }
                },
                update: {
                    allowed: input.allowed,
                    reason: input.reason,
                    expiresAt: input.expiresAt,
                    isActive: true,
                    updatedAt: new Date()
                },
                create: {
                    userId: input.userId,
                    accountId: input.accountId,
                    module: input.module,
                    action: input.action,
                    allowed: input.allowed,
                    reason: input.reason,
                    expiresAt: input.expiresAt,
                    isActive: true,
                    createdBy: input.createdBy
                }
            });
            
            created++;
            accountKeys.add(`${input.userId}:${input.accountId}`);
        }
        
        return created;
    });

    // Invalidate cache for all affected user-account pairs
    for (const key of accountKeys) {
        const [userId, accountId] = key.split(':');
        await invalidatePermissionCache(userId, accountId);
    }

    return result;
}
