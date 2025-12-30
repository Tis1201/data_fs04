import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import {
    getUserModulePermissions,
    upsertUserPermissionOverride,
    deleteUserPermissionOverride,
    invalidatePermissionCache,
    bulkCreateUserPermissionOverrides
} from '$lib/server/security/modulePermissions';
import type { UserPermissionOverrideInput } from '$lib/server/security/modulePermissions';
import { 
    USER_SIDEBAR_ITEMS, 
    ADMIN_SIDEBAR_ITEMS,
    ADMIN_CATEGORIES,
    USER_CATEGORIES
} from '$lib/constants/permissions';
import type { PermissionAction } from '$lib/constants/permissions';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// Get all modules from both admin and user sidebar items
function getAllModules(): string[] {
    const adminModules = Object.keys(ADMIN_SIDEBAR_ITEMS);
    const userModules = Object.keys(USER_SIDEBAR_ITEMS);
    return [...new Set([...adminModules, ...userModules])].sort();
}

export const load = restrictModule(
    async ({ params, locals, url }: AuthenticatedLoadEvent) => {
        const userId = params.id;
        const { prisma } = locals as any;

        if (!userId) {
            throw redirect(302, '/admin/users');
        }

        // Fetch user details
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, systemRole: true }
        });

        if (!user) {
            throw redirect(302, '/admin/users');
        }

        // Fetch all accounts the target user belongs to (not the admin's current account)
        const userAccountMemberships = await prisma.accountMembership.findMany({
            where: { 
                userId: userId,
                role: { not: 'SYSTEM' }
            },
            include: {
                account: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { account: { name: 'asc' } }
        });

        // If user has no account memberships
        if (userAccountMemberships.length === 0) {
            return {
                user,
                userAccounts: [],
                selectedAccountId: null,
                selectedAccount: null,
                allModules: getAllModules(),
                allActions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] as PermissionAction[],
                effectivePermissions: {},
                groupPermissions: {},
                noAccountsMessage: 'This user is not a member of any account.'
            };
        }

        // Allow selecting which account to view via query param
        const selectedAccountId = url.searchParams.get('accountId') || userAccountMemberships[0].account.id;
        const selectedAccount = userAccountMemberships.find((m: { account: { id: string; name: string } }) => m.account.id === selectedAccountId)?.account 
            || userAccountMemberships[0].account;

        // Fetch all possible modules and actions
        const allModules = getAllModules();
        const allActions: PermissionAction[] = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];

        // Fetch current group-based permissions for the user IN THE SELECTED ACCOUNT
        const groupPermissions = await getUserModulePermissions(userId, selectedAccount.id);

        // Fetch existing user-specific overrides IN THE SELECTED ACCOUNT
        const userOverrides = await prisma.userPermissionOverride.findMany({
            where: { userId, accountId: selectedAccount.id },
            select: { id: true, module: true, action: true, allowed: true, reason: true, expiresAt: true }
        });

        // Combine group permissions and overrides for display
        const effectivePermissions: Record<string, {
            groupAllowed: boolean;
            override: { id: string; allowed: boolean; reason: string | null; expiresAt: Date | null } | null;
        }> = {};

        allModules.forEach(module => {
            allActions.forEach(action => {
                const key = `${module}_${action}`;
                const groupAllowed = groupPermissions[module]?.includes(action) || false;
                const override = userOverrides.find((o: { module: string; action: string }) => o.module === module && o.action === action);

                effectivePermissions[key] = {
                    groupAllowed,
                    override: override ? { id: override.id, allowed: override.allowed, reason: override.reason, expiresAt: override.expiresAt } : null
                };
            });
        });

        return {
            user,
            userAccounts: userAccountMemberships.map((m: { account: { id: string; name: string } }) => m.account),
            selectedAccountId: selectedAccount.id,
            selectedAccount,
            allModules,
            allActions,
            effectivePermissions,
            groupPermissions,
            // Categories for structured display
            adminCategories: ADMIN_CATEGORIES,
            userCategories: USER_CATEGORIES,
            adminSidebarItems: ADMIN_SIDEBAR_ITEMS,
            userSidebarItems: USER_SIDEBAR_ITEMS
        };
    },
    'USERS',
    { action: 'EDIT' }
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action to create/update a user permission override
    upsertOverride: restrictModule(
        async ({ request, params, locals, getClientAddress }: ModuleAuthenticatedEvent) => {
            const { id: userId } = params;
            const { user: authUser, prisma } = locals as any;

            const formData = await request.formData();
            const accountId = formData.get('accountId')?.toString();
            
            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }
            
            // Verify user belongs to this account
            const membership = await prisma.accountMembership.findFirst({
                where: { userId, accountId }
            });
            if (!membership) {
                return fail(400, { error: 'User is not a member of this account' });
            }

            const module = formData.get('module')?.toString();
            const action = formData.get('action')?.toString() as PermissionAction;
            const allowed = formData.get('allowed')?.toString() === 'true';
            const overrideId = formData.get('overrideId')?.toString();
            const reason = formData.get('reason')?.toString() || null;
            const expiresAtString = formData.get('expiresAt')?.toString();
            const expiresAt = expiresAtString ? new Date(expiresAtString) : null;

            if (!module || !action) {
                return fail(400, { error: 'Module and action are required' });
            }

            try {
                // Check if override already exists
                const existingOverride = overrideId 
                    ? await prisma.userPermissionOverride.findUnique({ where: { id: overrideId } })
                    : null;

                const newData = { userId, accountId, module, action, allowed, reason, expiresAt };
                
                // Use upsert function for both create and update
                const result = await upsertUserPermissionOverride({
                    userId: userId as string,
                    accountId,
                    module,
                    action,
                    allowed,
                    reason: reason ?? undefined,
                    expiresAt: expiresAt ?? undefined,
                    createdBy: authUser.id
                });

                await logAudit({
                    actionType: existingOverride ? AuditActionType.UPDATE : AuditActionType.INSERT,
                    tableName: 'UserPermissionOverride',
                    recordId: result.id,
                    oldData: existingOverride,
                    newData: newData,
                    userId: authUser.id,
                    ipAddress: getClientAddress(),
                    prisma: prisma
                });

                return { success: true, message: 'Permission override saved successfully' };
            } catch (e) {
                logger.error('Error saving user permission override:', e);
                return fail(500, { error: 'Failed to save permission override' });
            }
        },
        'USERS',
        { action: 'EDIT' }
    ),

    // Action to delete a user permission override
    deleteOverride: restrictModule(
        async ({ request, params, locals, getClientAddress }: ModuleAuthenticatedEvent) => {
            const { user: authUser, prisma } = locals as any;

            const formData = await request.formData();
            const overrideId = formData.get('overrideId')?.toString();

            if (!overrideId) {
                return fail(400, { error: 'Override ID is required' });
            }

            try {
                const existingOverride = await prisma.userPermissionOverride.findUnique({ where: { id: overrideId } });
                if (!existingOverride) {
                    return fail(404, { error: 'Permission override not found' });
                }

                await deleteUserPermissionOverride(overrideId, authUser.id);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'UserPermissionOverride',
                    recordId: overrideId,
                    oldData: existingOverride,
                    newData: null,
                    userId: authUser.id,
                    ipAddress: getClientAddress(),
                    prisma: prisma
                });

                return { success: true, message: 'Permission override deleted successfully' };
            } catch (e) {
                logger.error('Error deleting user permission override:', e);
                return fail(500, { error: 'Failed to delete permission override' });
            }
        },
        'USERS',
        { action: 'EDIT' }
    ),

    // Action to apply quick templates (bulk override operations)
    applyTemplate: restrictModule(
        async ({ request, params, locals, getClientAddress }: ModuleAuthenticatedEvent) => {
            const { id: userId } = params;
            const { user: authUser, prisma } = locals as any;

            const formData = await request.formData();
            const template = formData.get('template')?.toString() as 'clear' | 'grant_view' | 'grant_all';
            const accountId = formData.get('accountId')?.toString();
            const accessLevel = formData.get('accessLevel')?.toString() as 'USER' | 'ADMIN';

            if (!template || !accountId || !accessLevel) {
                return fail(400, { error: 'Template, account ID, and access level are required' });
            }

            if (!userId) {
                return fail(400, { error: 'User ID is required' });
            }

            // Verify user belongs to this account
            const membership = await prisma.accountMembership.findFirst({
                where: { userId, accountId }
            });
            if (!membership) {
                return fail(400, { error: 'User is not a member of this account' });
            }

            try {
                const sidebarItems = accessLevel === 'ADMIN' ? ADMIN_SIDEBAR_ITEMS : USER_SIDEBAR_ITEMS;

                if (template === 'clear') {
                    // Delete all overrides for this user in this account for the current access level
                    const modulePrefix = accessLevel === 'ADMIN' ? '' : 'USER_';
                    const modulesToClear = Object.keys(sidebarItems);
                    
                    const deletedCount = await prisma.userPermissionOverride.deleteMany({
                        where: {
                            userId,
                            accountId,
                            module: { in: modulesToClear }
                        }
                    });

                    await invalidatePermissionCache(userId, accountId);

                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'UserPermissionOverride',
                        recordId: `bulk_clear_${userId}_${accountId}`,
                        oldData: { template: 'clear', accessLevel, count: deletedCount.count },
                        newData: null,
                        userId: authUser.id,
                        ipAddress: getClientAddress(),
                        prisma: prisma
                    });

                    return { success: true, message: `Cleared ${deletedCount.count} overrides` };
                } else {
                    // Build the overrides to create
                    const overrides: UserPermissionOverrideInput[] = [];
                    const actions = template === 'grant_view' ? ['VIEW'] : ['VIEW', 'CREATE', 'EDIT', 'DELETE'];

                    Object.entries(sidebarItems).forEach(([module, config]) => {
                        const moduleActions = config.actions as readonly string[];
                        actions.forEach(action => {
                            if (moduleActions.includes(action as any)) {
                                overrides.push({
                                    userId: userId as string,
                                    accountId,
                                    module,
                                    action: action as PermissionAction,
                                    allowed: true,
                                    reason: `Bulk ${template} via template`,
                                    createdBy: authUser.id
                                });
                            }
                        });
                    });

                    const createdCount = await bulkCreateUserPermissionOverrides(overrides);

                    await logAudit({
                        actionType: AuditActionType.INSERT,
                        tableName: 'UserPermissionOverride',
                        recordId: `bulk_${template}_${userId}_${accountId}`,
                        oldData: null,
                        newData: { template, accessLevel, count: createdCount },
                        userId: authUser.id,
                        ipAddress: getClientAddress(),
                        prisma: prisma
                    });

                    return { success: true, message: `Created ${createdCount} overrides` };
                }
            } catch (e) {
                logger.error('Error applying template:', e);
                return fail(500, { error: 'Failed to apply template' });
            }
        },
        'USERS',
        { action: 'EDIT' }
    )
};
