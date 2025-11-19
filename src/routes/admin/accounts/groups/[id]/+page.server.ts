import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { groupSchema } from '../../groups/new/group';
import { z } from 'zod';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import rawPrisma from '$lib/server/prisma'; // Raw Prisma client to bypass ZenStack policies

export const load = restrict(
    async ({ params, locals }) => {
        const { id } = params;
        
        try {
            // Use rawPrisma for ADMIN users to bypass ZenStack policies
            // This is necessary because Permission model requires account membership to read
            // but system ADMINs should be able to view all permissions
            const prismaClient = rawPrisma;
            
            // Fetch the group by ID
            const group = await prismaClient.group.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    members: {
                        include: {
                            membership: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            name: true,
                                            email: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    permissions: true // Fetch permissions
                }
            });
            
            // If group doesn't exist, throw a 404 error
            if (!group) {
                throw error(404, {
                    message: 'Group not found',
                    code: 'GROUP_NOT_FOUND'
                });
            }
            
            // Get all accounts for the dropdown (use rawPrisma for consistency)
            const accounts = await prismaClient.account.findMany({
                where: { status: 'ACTIVE', isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            
            // Get all account members for the admin panel (use rawPrisma)
            const accountMembers = await prismaClient.accountMembership.findMany({
                where: {
                    accountId: group.accountId,
                    role: { not: 'SYSTEM' }
                    // No filter for group membership to show all users
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    // Include group memberships to identify which users are already in the group
                    groupMemberships: {
                        where: {
                            groupId: id
                        },
                        select: {
                            id: true
                        }
                    }
                },
                orderBy: {
                    user: {
                        name: 'asc'
                    }
                }
            });
            
            // Initialize the form with the group data
            const form = await superValidate(
                {
                    name: group.name,
                    description: group.description || '',
                    accountId: group.accountId,
                    permissions: {} // Initialize as empty object (will be serialized as JSON)
                }, 
                zod(groupSchema)
            );

            // Create a form for adding users to the group
            const addUserSchema = z.object({
                membershipId: z.string().optional()
            });
            const addUserForm = await superValidate(
                { membershipId: '' },
                zod(addUserSchema)
            );
            
            // Transform permissions into a map for easy lookup
            // Format: MODULE_ACTION (e.g., "DEVICES_VIEW")
            const rawPermissions = group.permissions.map((p: any) => `${p.module}_${p.action}=${p.allowed}`);
            logger.info(`[LOAD] Group ${id} - Raw permissions from DB (count: ${group.permissions.length}):`, rawPermissions);
            
            const permissionMap: Record<string, boolean> = {};
            group.permissions.forEach((perm: any) => {
                const key = `${perm.module}_${perm.action}`;
                if (perm.allowed) {
                    permissionMap[key] = true;
                }
            });
            
            const permMapKeys = Object.keys(permissionMap);
            logger.info(`[LOAD] Group ${id} - Permission map created (count: ${permMapKeys.length}):`, permMapKeys);
            
            // Determine group role based on permissions
            // If group has admin-only permissions (like ACCOUNTS, GENERAL_SETTINGS), it's ADMIN
            // Otherwise, default to ADMIN
            let groupRole: 'ADMIN' | 'USER' = 'ADMIN';
            const adminOnlyModules = ['ACCOUNTS', 'COMPANIES', 'GROUPS', 'ADMIN_USERS', 'LICENSES', 
                                     'SIGNING_KEYS', 'API_KEYS', 'REFRESH_TOKENS', 'TOKEN_LOGS', 
                                     'GENERAL_SETTINGS', 'EMAIL_SETTINGS', 'MONITOR', 'DEBUG_SSE', 
                                     'DEBUG_MESSAGING', 'DEBUG_REDIS', 'STREAMS', 'PREVIEW', 'WEBHOOK', 
                                     'LISTENERS', 'FACTORY_TOKENS'];
            
            for (const perm of group.permissions) {
                if (adminOnlyModules.includes(perm.module)) {
                    groupRole = 'ADMIN';
                    logger.info(`[LOAD] Group ${id} - Detected ADMIN role from module: ${perm.module}`);
                    break;
                }
            }
            
            logger.info(`[LOAD] Group ${id} - Final groupRole: ${groupRole}`);

            return {
                form,
                group,
                accounts,
                accountMembers,
                addUserForm,
                permissionMap,
                groupRole
            };
        } catch (err) {
            if (err.status === 404) {
                throw err;
            }
            logger.error('Error loading group:', err);
            throw error(500, 'Failed to load group details');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for updating a group using Superforms
    updateGroup: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            
            // Validate the form data against the schema
            const form = await superValidate(request, zod(groupSchema));

            // If validation fails, return the form with errors
            if (!form.valid) {
                logger.warn('Form validation failed', { errors: form.errors });
                return fail(400, { form });
            }

            try {
                // Check if the group exists
                const existingGroup = await locals.prisma.group.findUnique({
                    where: { id }
                });

                if (!existingGroup) {
                    return message(form, {
                        type: 'error',
                        text: 'Group not found',
                        code: 'GROUP_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }
                
                // Check if the account exists
                const account = await locals.prisma.account.findUnique({
                    where: { id: form.data.accountId }
                });

                if (!account) {
                    return message(form, {
                        type: 'error',
                        text: 'Selected account does not exist',
                        code: 'ACCOUNT_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 400 });
                }

                // Update the group (permissions are managed separately as relations)
                const updatedGroup = await locals.prisma.group.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        description: form.data.description || null,
                        accountId: form.data.accountId
                    }
                });

                // Log the group update
                logger.info(`Group updated: ${updatedGroup.id} (${updatedGroup.name})`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Group',
                    recordId: updatedGroup.id,
                    oldData: existingGroup,
                    newData: updatedGroup,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })

                // Return success - client onResult will handle the toast
                return { form };
            } catch (err) {
                logger.error(`Error updating group: , ${err}`);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to update group: ' + (err instanceof Error ? err.message : 'Unknown error')
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    // Action for adding a user to a group
    addUser: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            
            // Get the form data directly
            const formData = await request.formData();
            const membershipId = formData.get('membershipId')?.toString();
            
            // Create a form schema for validation
            const addUserSchema = z.object({
                membershipId: z.string().optional()
            });
            
            // Create the form for validation and error handling
            const form = await superValidate(
                { membershipId: membershipId || '' },
                zod(addUserSchema)
            );
            
            // Validate the membershipId - it's required when submitting this action
            if (!membershipId || membershipId.trim() === '') {
                return message(form, {
                    type: 'error',
                    text: 'Please select a user to add',
                    code: 'USER_NOT_SELECTED',
                    timestamp: new Date().toISOString()
                }, { status: 400 });
            }

            try {
                // Check if the group exists
                const group = await locals.prisma.group.findUnique({
                    where: { id }
                });

                if (!group) {
                    return message(form, {
                        type: 'error',
                        text: 'Group not found',
                        code: 'GROUP_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }
                
                // Check if the membership exists
                const membership = await locals.prisma.accountMembership.findUnique({
                    where: { id: membershipId, role: { not: 'SYSTEM' } },
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true
                            }
                        }
                    }
                });

                if (!membership) {
                    return message(form, {
                        type: 'error',
                        text: 'Selected user does not exist',
                        code: 'USER_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 400 });
                }
                
                // Check if user is already in the group
                const existingMembership = await locals.prisma.groupMembership.findFirst({
                    where: {
                        groupId: id,
                        membershipId: membershipId
                    }
                });
                
                if (existingMembership) {
                    return message(form, {
                        type: 'error',
                        text: 'User is already a member of this group',
                        code: 'USER_ALREADY_MEMBER',
                        timestamp: new Date().toISOString()
                    }, { status: 400 });
                }

                // Add the user to the group
                const groupMembership = await locals.prisma.groupMembership.create({
                    data: {
                        groupId: id,
                        membershipId: membershipId
                    },
                    include: {
                        membership: {
                            include: {
                                user: true
                            }
                        }
                    }
                });

                // Log the user addition
                logger.info(`User added to group: ${membership.user.name} (${membership.user.email}) added to ${group.name}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'GroupMembership',
                    recordId: groupMembership.id,
                    oldData: null,
                    newData: groupMembership,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })

                // Return success
                // Create a new form for the next submission
                const newForm = await superValidate(
                    { membershipId: '' },
                    zod(addUserSchema)
                );
                
                return {
                    addUserForm: newForm,
                    type: 'success',
                    text: `${membership.user.name || membership.user.email} added to group successfully!`
                };
            } catch (err) {
                logger.error(`Error adding user to group: ${err}`);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to add user to group: ' + (err instanceof Error ? err.message : 'Unknown error')
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    // Action for removing a user from a group
    removeUser: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const membershipId = formData.get('membershipId')?.toString();
            
            if (!membershipId) {
                return fail(400, { error: 'User ID is required' });
            }
            
            try {
                // Check if the group membership exists
                const groupMembership = await locals.prisma.groupMembership.findFirst({
                    where: {
                        groupId: id,
                        membershipId
                    },
                    include: {
                        membership: {
                            include: {
                                user: {
                                    select: {
                                        name: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        group: true
                    }
                });
                
                if (!groupMembership) {
                    return fail(404, { error: 'User is not a member of this group' });
                }
                
                // Remove the user from the group
                await locals.prisma.groupMembership.delete({
                    where: {
                        id: groupMembership.id
                    }
                });
                
                // Log the user removal
                logger.info(`User removed from group: ${groupMembership.membership.user.name} (${groupMembership.membership.user.email}) removed from ${groupMembership.group.name}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'GroupMembership',
                    recordId: groupMembership.id,
                    oldData: groupMembership,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return {
                    success: true,
                    message: `${groupMembership.membership.user.name} removed from group successfully!`
                };
            } catch (err) {
                logger.error(`Error removing user from group: ${err}`);
                return fail(500, { error: 'Failed to remove user from group: ' + (err instanceof Error ? err.message : 'Unknown error') });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Update group permissions
    updatePermissions: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const permissionsJson = formData.get('permissions')?.toString();
            const groupRole = formData.get('groupRole')?.toString() as 'ADMIN' | 'USER' | undefined;
            
            if (!permissionsJson) {
                return fail(400, { error: 'Permissions data is required' });
            }
            
            if (!groupRole || (groupRole !== 'ADMIN' && groupRole !== 'USER')) {
                return fail(400, { error: 'Valid group role (ADMIN or USER) is required' });
            }
            
            try {
                const permissions = JSON.parse(permissionsJson);
                
                logger.info(`[SAVE] Group ${id} - Received permissions to save:`, { 
                    groupRole,
                    permissionCount: Object.keys(permissions).length,
                    permissions: Object.entries(permissions)
                        .filter(([_, allowed]) => allowed)
                        .map(([key, _]) => key)
                });
                
                // Check if the group exists
                const existingGroup = await locals.prisma.group.findUnique({
                    where: { id },
                    include: { permissions: true }
                });

                if (!existingGroup) {
                    return fail(404, { error: 'Group not found' });
                }
                
                logger.info(`[SAVE] Group ${id} - Existing permissions in DB:`, {
                    count: existingGroup.permissions.length,
                    permissions: existingGroup.permissions.map((p: any) => `${p.module}_${p.action}`)
                });
                
                // Process permissions into a structure we can save
                // New format: MODULE_ACTION (e.g., "DEVICES_VIEW")
                const permissionRecords: Array<{
                    module: string;
                    action: string;
                    allowed: boolean;
                }> = [];
                
                Object.entries(permissions).forEach(([key, allowed]) => {
                    if (typeof allowed !== 'boolean' || !allowed) return;
                    
                    // Parse key format: MODULE_ACTION
                    // Split by underscore, last part is action, rest is module
                    const parts = key.split('_');
                    if (parts.length < 2) return;
                    
                    // Last part is the action
                    const action = parts[parts.length - 1];
                    
                    // Everything before that is the module
                    const module = parts.slice(0, -1).join('_');
                    
                    // Validate action
                    if (!['VIEW', 'CREATE', 'EDIT', 'DELETE'].includes(action)) {
                        logger.warn(`[SAVE] Group ${id} - Invalid action in key ${key}: ${action}`);
                        return;
                    }
                    
                    permissionRecords.push({ module, action, allowed: true });
                });
                
                logger.info(`[SAVE] Group ${id} - Processed permission records:`, {
                    count: permissionRecords.length,
                    records: permissionRecords.map(p => `${p.module}_${p.action}`)
                });
                
                // Use transaction to update permissions
                // Use rawPrisma to bypass ZenStack policies for ADMIN users
                // System admins should be able to manage permissions regardless of account membership
                await rawPrisma.$transaction(async (tx: any) => {
                    // Delete existing permissions
                    logger.info(`[SAVE] Group ${id} - Deleting existing permissions...`);
                    const deletedCount = await tx.permission.deleteMany({
                        where: { groupId: id }
                    });
                    logger.info(`[SAVE] Group ${id} - Deleted ${deletedCount.count} existing permissions`);
                    
                    // Create new permissions
                    if (permissionRecords.length > 0) {
                        const dataToCreate = permissionRecords.map(perm => ({
                            groupId: id,
                            module: perm.module,
                            action: perm.action,
                            allowed: perm.allowed
                        }));
                        
                        logger.info(`[SAVE] Group ${id} - Creating ${dataToCreate.length} new permissions:`, dataToCreate);
                        
                        const createResult = await tx.permission.createMany({
                            data: dataToCreate
                        });
                        
                        logger.info(`[SAVE] Group ${id} - Created ${createResult.count} new permissions`);
                    } else {
                        logger.warn(`[SAVE] Group ${id} - No permissions to create (all permissions cleared)`);
                    }
                });
                
                // Verify the permissions were saved
                const verifyPermissions = await rawPrisma.permission.findMany({
                    where: { groupId: id }
                });
                logger.info(`[SAVE] Group ${id} - Verification: ${verifyPermissions.length} permissions in DB after save:`, 
                    verifyPermissions.map((p: any) => `${p.module}_${p.action}`)
                );
                
                logger.info(`[SAVE] Group ${id} - Permissions updated successfully (Role: ${groupRole}, Permissions: ${permissionRecords.length})`);
                
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Permission',
                    recordId: id,
                    oldData: existingGroup.permissions,
                    newData: permissionRecords,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });
                
                return { success: true };
            } catch (err) {
                logger.error(`Error updating permissions: ${err}`);
                return fail(500, { error: 'Failed to update permissions: ' + (err instanceof Error ? err.message : 'Unknown error') });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Delete group action
    deleteGroup: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;

            if (!id) {
                return fail(400, { error: 'Group ID is required' });
            }

            try {
                logger.info(`Starting group deletion process for ID: ${id}`);

                // Check if group exists first
                const existingGroup = await locals.prisma.group.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        accountId: true,
                        _count: {
                            select: {
                                members: true
                            }
                        }
                    }
                });

                if (!existingGroup) {
                    logger.warn(`Group not found: ${id}`);
                    return fail(404, { error: 'Group not found' });
                }

                logger.info(`Found group: ${existingGroup.name} (${existingGroup.id})`);

                // Check if group has members that would prevent deletion
                const hasMembers = existingGroup._count.members > 0;

                if (hasMembers) {
                    const errorMsg = `Cannot delete group with existing members: ${existingGroup._count.members} members. Please remove all members first.`;
                    logger.warn(`Deletion blocked for group ${id}: ${errorMsg}`);
                    
                    return fail(400, { error: errorMsg });
                }

                logger.info(`No members found, proceeding with deletion of group: ${id}`);

                // Delete the group
                const deletedGroup = await locals.prisma.group.delete({
                    where: { id }
                });

                logger.info(`Group successfully deleted from database: ${deletedGroup.id} (${deletedGroup.name})`);

                // Audit logging with better error handling
                try {
                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'Group',
                        recordId: id,
                        oldData: deletedGroup,
                        newData: null,
                        userId: locals.user?.id || 'unknown',
                        ipAddress: locals.ipAddress || 'unknown',
                        prisma: locals.prisma
                    });
                    logger.info(`Audit log entry created for group deletion: ${id}`);
                } catch (auditError) {
                    // Don't fail the deletion if audit logging fails
                    logger.error('Failed to create audit log entry:', auditError as Record<string, any>);
                }

                logger.info(`Group deletion completed successfully: ${id}`);
                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                const stackTrace = err instanceof Error ? err.stack : undefined;
                
                logger.error(`Error deleting group ${id}:`, { 
                    message: errorMsg, 
                    stack: stackTrace,
                    groupId: id
                });
                
                // Provide more specific error messages based on the error type
                if (errorMsg.includes('Foreign key constraint')) {
                    return fail(400, { error: 'Cannot delete group - it is still referenced by other records. Please remove all related data first.' });
                } else if (errorMsg.includes('Record to delete does not exist')) {
                    return fail(404, { error: 'Group not found or already deleted.' });
                } else {
                    return fail(500, { error: `Failed to delete group: ${errorMsg}` });
                }
            }
        },
        [SystemRole.ADMIN]
    )
};
