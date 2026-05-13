import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { groupSchema } from './group';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import rawPrisma from '$lib/server/prisma';

export const load: PageServerLoad = restrictModule(
    async ({ locals }: AuthenticatedLoadEvent) => {
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(groupSchema));
            
            // Get all accounts for the dropdown
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            
            // Get all account members (for adding users to group)
            const accountMembers = await rawPrisma.accountMembership.findMany({
                where: {
                    role: { not: 'SYSTEM' }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    user: {
                        name: 'asc'
                    }
                }
            });
            
            return {
                form,
                accounts,
                accountMembers
            };
        } catch (err) {
            logger.error('Error loading group form:', { error: err });
            throw error(500, 'Failed to load group form');
        }
    },
    'GROUPS',
    { action: 'CREATE' }
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrictModule(
        async ({ request, locals, auth, getClientAddress }: ModuleAuthenticatedEvent) => {
            // Read formData first to avoid "Body already read" error
            const formData = await request.formData();
            
            // Validate the form data using the formData object
            const form = await superValidate(formData, zod(groupSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                const permissionsJson = formData.get('permissions')?.toString();
                const groupRole = formData.get('groupRole')?.toString();
                const userIdsJson = formData.get('userIds')?.toString();
                
                logger.info('[CREATE GROUP] Starting group creation:', {
                    name: form.data.name,
                    accountId: form.data.accountId,
                    hasPermissions: !!permissionsJson,
                    groupRole,
                    hasUsers: !!userIdsJson
                });
                
                // First, check if the account exists
                const account = await locals.prisma.account.findUnique({
                    where: { id: form.data.accountId }
                });
                
                if (!account) {
                    return fail(400, { 
                        form, 
                        error: 'The selected account does not exist' 
                    });
                }
                
                // Parse user IDs
                let userIds: string[] = [];
                if (userIdsJson) {
                    try {
                        userIds = JSON.parse(userIdsJson);
                    } catch (e) {
                        logger.warn('[CREATE GROUP] Failed to parse user IDs', { error: e });
                    }
                }
                
                // Parse permissions
                let permissionRecords: Array<{ module: string; action: string; allowed: boolean }> = [];
                if (permissionsJson) {
                    try {
                        const permissions = JSON.parse(permissionsJson);
                        
                        Object.entries(permissions).forEach(([key, allowed]) => {
                            if (typeof allowed !== 'boolean' || !allowed) return;
                            
                            const parts = key.split('_');
                            if (parts.length < 2) return;
                            
                            const action = parts[parts.length - 1];
                            const module = parts.slice(0, -1).join('_');
                            
                            if (!['VIEW', 'CREATE', 'EDIT', 'DELETE'].includes(action)) return;
                            
                            permissionRecords.push({ module, action, allowed: true });
                        });
                        
                        logger.info('[CREATE GROUP] Processed permissions:', {
                            count: permissionRecords.length,
                            records: permissionRecords.map(p => `${p.module}_${p.action}`)
                        });
                    } catch (e) {
                        logger.error('[CREATE GROUP] Failed to parse permissions', { error: e });
                    }
                }
                
                // Use transaction to create group, permissions, and memberships atomically
                const result = await rawPrisma.$transaction(async (tx) => {
                    // Create the group
                    const group = await tx.group.create({
                        data: {
                            name: form.data.name,
                            description: form.data.description,
                            accountId: form.data.accountId
                        }
                    });
                    
                    logger.info('[CREATE GROUP] Group created:', { groupId: group.id });
                    
                    // Create permissions if any
                    if (permissionRecords.length > 0) {
                        await tx.permission.createMany({
                            data: permissionRecords.map(perm => ({
                                groupId: group.id,
                                module: perm.module,
                                action: perm.action,
                                allowed: perm.allowed
                            }))
                        });
                        logger.info('[CREATE GROUP] Created permissions', { count: permissionRecords.length });
                    }
                    
                    // Add users to group if any
                    if (userIds.length > 0) {
                        await tx.groupMembership.createMany({
                            data: userIds.map(membershipId => ({
                                groupId: group.id,
                                membershipId
                            }))
                        });
                        logger.info('[CREATE GROUP] Added users to group', { count: userIds.length });
                        
                        // Get created memberships for audit logging
                        const createdMemberships = await tx.groupMembership.findMany({
                            where: {
                                groupId: group.id,
                                membershipId: { in: userIds }
                            }
                        });
                        
                        // Log audit for each created membership
                        const auditUserId = locals.user?.id ?? auth?.user?.id ?? '';
                        const auditIp = (locals as any).ipAddress ?? getClientAddress();
                        
                        for (const membership of createdMemberships) {
                            await logAudit({
                                actionType: AuditActionType.INSERT,
                                tableName: 'GroupMembership',
                                recordId: membership.id,
                                oldData: null,
                                newData: membership,
                                userId: auditUserId,
                                ipAddress: auditIp,
                                prisma: tx
                            });
                        }
                    }
                    
                    return group;
                });
                
                logger.info(`[CREATE GROUP] Successfully created group: ${result.id} (${result.name})`);

                const auditUserId = locals.user?.id ?? auth?.user?.id ?? '';
                const auditIp = (locals as any).ipAddress ?? getClientAddress();

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Group',
                    recordId: result.id,
                    oldData: null,
                    newData: {
                        ...result,
                        permissions: permissionRecords,
                        members: userIds
                    },
                    userId: auditUserId,
                    ipAddress: auditIp,
                    prisma: locals.prisma
                });
                
                return { 
                    form,
                    success: true,
                    type: 'success',
                    message: {
                        type: 'success' as const,
                        text: 'Group created successfully',
                        details: `Group '${result.name}' has been created with ${permissionRecords.length} permissions and ${userIds.length} members.`
                    }
                };
            } catch (err) {
                logger.error('[CREATE GROUP] Error creating group', { error: err });
                return fail(500, { 
                    form, 
                    error: 'Failed to create group: ' + (err instanceof Error ? err.message : 'Unknown error')
                });
            }
        },
        'GROUPS',
        { action: 'CREATE' }
    )
};
