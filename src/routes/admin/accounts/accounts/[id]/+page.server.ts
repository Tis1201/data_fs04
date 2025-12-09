import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createSuccessResponse } from '$lib/types/api';
import { accountEditSchema, relationshipSchema, companyCreateSchema } from '../schema';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';


export const load = restrict(
    async ({ params, locals } : AuthenticatedLoadEvent) => {
        const { id } = params;
        
        // Fetch the account by ID with related data
        const account = await locals.prisma.account.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        companies: true,
                        members: true,
                        groups: true,
                        devices: true,
                        resources: true
                    }
                }
            }
        });
        
        // If account doesn't exist, throw a 404 error
        if (!account) {
            throw error(404, 'Account not found');
        }

        // Fetch related data for the relationship sections
        const [companies, members, groups, availableCompanies, availableUsers, availableGroups] = await Promise.all([
            // Companies
            locals.prisma.company.findMany({
                where: { accountId: id },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    createdAt: true,
                    _count: {
                        select: {
                            devices: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            }),
            
            // Members (AccountMemberships with User data)
            locals.prisma.accountMembership.findMany({
                where: { accountId: id, role: { not: 'SYSTEM' } },
                select: {
                    id: true,
                    role: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            status: true,
                            systemRole: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            
            // Groups
            locals.prisma.group.findMany({
                where: { accountId: id },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    createdAt: true,
                    _count: {
                        select: {
                            members: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            }),

            // Available companies (not yet associated with this account)
            locals.prisma.company.findMany({
                where: { 
                    accountId: { not: id },
                    status: 'ACTIVE'
                },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    description: true
                },
                orderBy: { name: 'asc' }
            }),

            // Available users (not yet members of this account)
            locals.prisma.user.findMany({
                where: {
                    accountMemberships: {
                        none: {
                            accountId: id
                        }
                    },
                    status: 'ACTIVE'
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    status: true,
                    systemRole: true
                },
                orderBy: { email: 'asc' }
            }),

            // Available groups (not yet in this account) - REMOVED status field
            locals.prisma.group.findMany({
                where: { 
                    accountId: { not: id }
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    createdAt: true
                },
                orderBy: { name: 'asc' }
            })
        ]);
        
        // Initialize the form with the account data
        const form = await superValidate(
            {
                name: account.name,
                slug: account.slug,
                description: account.description || '',
                status: account.status as "ACTIVE" | "INACTIVE"
            }, 
            zod(accountEditSchema)
        );

        return {
            form,
            account,
            relationships: {
                companies,
                members,
                groups
            },
            availableCompanies,
            availableUsers,
            availableGroups
        };
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    updateAccount: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id } = params;
            
            const form = await superValidate(request, zod(accountEditSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const existingAccount = await locals.prisma.account.findUnique({
                    where: { id }
                });

                if (!existingAccount) {
                    return message(form, {
                        type: 'error',
                        text: 'Account not found',
                        code: 'ACCOUNT_NOT_FOUND'
                    }, { status: 404 });
                }
                
                if (form.data.slug !== existingAccount.slug) {
                    const slugExists = await locals.prisma.account.findFirst({
                        where: { 
                            slug: form.data.slug,
                            id: { not: id }
                        }
                    });

                    if (slugExists) {
                        return message(form, {
                            type: 'error',
                            text: 'Account with this slug already exists',
                            details: 'Please choose a different slug',
                            code: 'SLUG_EXISTS'
                        }, { status: 400 });
                    }
                }

                const account = await locals.prisma.account.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        slug: form.data.slug,
                        description: form.data.description || null,
                        status: form.data.status
                    },
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true
                    }
                });

                logger.info(`Account updated: ${account.id} (${account.name})`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Account',
                    recordId: account.id,
                    oldData: existingAccount,
                    newData: account,
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return message(form, createSuccessResponse('Account updated successfully', {
                    details: `Account '${account.name}' has been updated.`,
                    data: {
                        id: account.id,
                        name: account.name,
                        slug: account.slug,
                        description: account.description,
                        status: account.status,
                        createdAt: account.createdAt.toISOString(),
                        updatedAt: account.updatedAt.toISOString()
                    }
                }));
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error updating account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error updating account:', { error: err });
                }
                return message(form, {
                    type: 'error',
                    text: 'Failed to update account',
                    details: err instanceof Error ? err.message : 'Unknown error',
                    code: 'UPDATE_FAILED'
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Create new company and add to account
    createAndAddCompany: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id: accountId } = params;

            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }

            const form = await superValidate(request, zod(companyCreateSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if account exists
                const account = await locals.prisma.account.findUnique({
                    where: { id: accountId }
                });

                if (!account) {
                    return message(form, {
                        type: 'error',
                        text: 'Account not found',
                        code: 'ACCOUNT_NOT_FOUND'
                    }, { status: 404 });
                }

                // Create the company with the account association
                const company = await locals.prisma.company.create({
                    data: {
                        name: form.data.name,
                        contactEmail: form.data.contactEmail,
                        contactPhone: form.data.contactPhone || null,
                        address: form.data.address || null,
                        description: form.data.description || null,
                        status: form.data.status,
                        accountId: accountId
                    },
                    select: {
                        id: true,
                        name: true,
                        contactEmail: true,
                        status: true,
                        createdAt: true
                    }
                });

                logger.info(`New company created and added to account: ${company.id} (${company.name}) -> ${accountId}`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Company',
                    recordId: company.id,
                    oldData: null,
                    newData: company,
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return message(form, createSuccessResponse('Company created successfully', {
                    details: `Company '${company.name}' has been created and added to the account.`,
                    data: company
                }));
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error creating company:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error creating company:', { error: err });
                }
                return message(form, {
                    type: 'error',
                    text: 'Failed to create company',
                    details: err instanceof Error ? err.message : 'Unknown error',
                    code: 'CREATE_FAILED'
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Add companies to account (handles both single and multiple)
    addCompany: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id: accountId } = params;

            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }

            try {
                const formData = await request.formData();
                const itemId = formData.get('itemId');

                // Handle both single itemId (string) and multiple itemIds (JSON array)
                let itemIds: string[];

                if (typeof itemId === 'string') {
                    try {
                        // Try to parse as JSON array first
                        const parsed = JSON.parse(itemId);
                        itemIds = Array.isArray(parsed) ? parsed : [itemId];
                    } catch {
                        // If not JSON, treat as single item
                        itemIds = [itemId];
                    }
                } else {
                    return fail(400, { error: 'Invalid item ID format' });
                }

                // Validate item IDs
                if (itemIds.length === 0) {
                    return fail(400, { error: 'At least one item ID is required' });
                }

                // Check if all companies exist and are not already associated
                const companies = await locals.prisma.company.findMany({
                    where: {
                        id: { in: itemIds },
                        accountId: { not: accountId }
                    }
                });

                if (companies.length !== itemIds.length) {
                    const foundIds = companies.map(c => c.id);
                    const missingIds = itemIds.filter(id => !foundIds.includes(id));

                    return fail(400, {
                        error: `Some companies not found or already associated: ${missingIds.join(', ')}`
                    });
                }

                // Update all companies to associate with this account
                await locals.prisma.company.updateMany({
                    where: {
                        id: { in: itemIds }
                    },
                    data: { accountId }
                });

                logger.info(`Companies ${itemIds.join(', ')} added to account ${accountId}`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Company',
                    recordId: itemIds,
                    oldData: { accountId: null },
                    newData: { accountId },
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return { success: true };
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error adding companies to account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error adding companies to account:', { error: err });
                }
                return fail(500, { error: 'Failed to add companies to account' });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Add members to account (handles both single and multiple)
    addMember: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id: accountId } = params;

            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }

            try {
                const formData = await request.formData();
                const itemId = formData.get('itemId');
                const role = formData.get('role'); // Get role from form data

                // Handle both single itemId (string) and multiple itemIds (JSON array)
                let itemIds: string[];

                if (typeof itemId === 'string') {
                    try {
                        // Try to parse as JSON array first
                        const parsed = JSON.parse(itemId);
                        itemIds = Array.isArray(parsed) ? parsed : [itemId];
                    } catch {
                        // If not JSON, treat as single item
                        itemIds = [itemId];
                    }
                } else {
                    return fail(400, { error: 'Invalid item ID format' });
                }

                // Validate role parameter
                const validRoles = ['OWNER', 'ADMIN', 'MEMBER'];
                const memberRole = typeof role === 'string' && validRoles.includes(role) ? role : 'MEMBER';

                // Validate item IDs
                if (itemIds.length === 0) {
                    return fail(400, { error: 'At least one item ID is required' });
                }

                // Check if all users exist and are not already members
                const existingMemberships = await locals.prisma.accountMembership.findMany({
                    where: {
                        userId: { in: itemIds },
                        accountId
                    }
                });

                if (existingMemberships.length > 0) {
                    const existingUserIds = existingMemberships.map(m => m.userId);
                    return fail(400, {
                        error: `Some users are already members: ${existingUserIds.join(', ')}`
                    });
                }

                // Create new memberships for all users with the specified role
                const membershipData = itemIds.map(userId => ({
                    userId,
                    accountId,
                    role: memberRole // Use the provided role instead of hardcoded 'MEMBER'
                }));

                await locals.prisma.accountMembership.createMany({
                    data: membershipData
                });

                logger.info(`Users ${itemIds.join(', ')} added to account ${accountId} with role ${memberRole}`);

                const memberships = await locals.prisma.accountMembership.findMany({
                    where: {
                        userId: { in: itemIds },
                        accountId,
                        role: { not: 'SYSTEM' }
                    }
                });

                const authSession = await locals.auth.validate();

                await Promise.all(
                    memberships.map(membership =>
                        logAudit({
                            actionType: AuditActionType.INSERT,
                            tableName: 'AccountMembership',
                            recordId: membership.id,
                            oldData: null,
                            newData: membership,
                            userId: authSession?.user?.id ?? '',
                            ipAddress: event.getClientAddress(),
                            prisma: locals.prisma
                        })
                    )
                );

                return { success: true };
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error adding members to account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error adding members to account:', { error: err });
                }
                return fail(500, { error: 'Failed to add members to account' });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Add groups to account (handles both single and multiple)
    addGroup: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id: accountId } = params;

            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }

            try {
                const formData = await request.formData();
                const itemId = formData.get('itemId');

                // Handle both single itemId (string) and multiple itemIds (JSON array)
                let itemIds: string[];

                if (typeof itemId === 'string') {
                    try {
                        // Try to parse as JSON array first
                        const parsed = JSON.parse(itemId);
                        itemIds = Array.isArray(parsed) ? parsed : [itemId];
                    } catch {
                        // If not JSON, treat as single item
                        itemIds = [itemId];
                    }
                } else {
                    return fail(400, { error: 'Invalid item ID format' });
                }

                // Validate item IDs
                if (itemIds.length === 0) {
                    return fail(400, { error: 'At least one item ID is required' });
                }

                // Check if all groups exist and are not already in this account
                const groups = await locals.prisma.group.findMany({
                    where: {
                        id: { in: itemIds },
                        accountId: { not: accountId }
                    }
                });

                if (groups.length !== itemIds.length) {
                    const foundIds = groups.map(g => g.id);
                    const missingIds = itemIds.filter(id => !foundIds.includes(id));

                    return fail(400, {
                        error: `Some groups not found or already in this account: ${missingIds.join(', ')}`
                    });
                }

                // Update all groups to associate with this account
                await locals.prisma.group.updateMany({
                    where: {
                        id: { in: itemIds }
                    },
                    data: { accountId }
                });

                logger.info(`Groups ${itemIds.join(', ')} added to account ${accountId}`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Group',
                    recordId: itemIds,
                    oldData: { accountId: null },
                    newData: { accountId },
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return { success: true };
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error adding groups to account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error adding groups to account:', { error: err });
                }
                return fail(500, { error: 'Failed to add groups to account' });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Remove company from account
    removeCompany: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id: accountId } = params;

            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }

            const form = await superValidate(request, zod(relationshipSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if company exists and belongs to this account
                const company = await locals.prisma.company.findFirst({
                    where: {
                        id: form.data.itemId,
                        accountId
                    }
                });

                if (!company) {
                    return message(form, {
                        type: 'error',
                        text: 'Company not found or not associated with this account',
                        code: 'COMPANY_NOT_FOUND'
                    }, { status: 404 });
                }

                // Delete the company (since accountId is required, we can't just unlink it)
                await locals.prisma.company.delete({
                    where: {
                        id: form.data.itemId
                    }
                });

                logger.info(`Company ${form.data.itemId} removed from account ${accountId}`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Company',
                    recordId: form.data.itemId,
                    oldData: company,
                    newData: null,
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return { success: true };
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error removing company from account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error removing company from account:', { error: err });
                }
                return message(form, {
                    type: 'error',
                    text: 'Failed to remove company from account',
                    code: 'REMOVE_FAILED'
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Remove member from account
    removeMember: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id: accountId } = params;

            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }

            const form = await superValidate(request, zod(relationshipSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const accountMembership = await locals.prisma.accountMembership.delete({
                    where: {
                        userId_accountId: {
                            userId: form.data.itemId,
                            accountId
                        },
                        role: { not: 'SYSTEM' }
                    }
                });

                logger.info(`User ${form.data.itemId} removed from account ${accountId}`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'AccountMembership',
                    recordId: accountMembership.id,
                    oldData: accountMembership,
                    newData: null,
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return { success: true };
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error removing member from account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error removing member from account:', { error: err });
                }
                return message(form, {
                    type: 'error',
                    text: 'Failed to remove member from account',
                    code: 'REMOVE_FAILED'
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Remove group from account
    removeGroup: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id: accountId } = params;

            if (!accountId) {
                return fail(400, { error: 'Account ID is required' });
            }

            const form = await superValidate(request, zod(relationshipSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if group exists and belongs to this account
                const group = await locals.prisma.group.findFirst({
                    where: {
                        id: form.data.itemId,
                        accountId
                    }
                });

                if (!group) {
                    return message(form, {
                        type: 'error',
                        text: 'Group not found or not associated with this account',
                        code: 'GROUP_NOT_FOUND'
                    }, { status: 404 });
                }

                // Delete the group (since accountId is required, we can't just unlink it)
                await locals.prisma.group.delete({
                    where: {
                        id: form.data.itemId
                    }
                });

                logger.info(`Group ${form.data.itemId} removed from account ${accountId}`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Group',
                    recordId: group.id,
                    oldData: group,
                    newData: null,
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                })

                return { success: true };
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error removing group from account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error removing group from account:', { error: err });
                }
                return message(form, {
                    type: 'error',
                    text: 'Failed to remove group from account',
                    code: 'REMOVE_FAILED'
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),

    // Delete account action
    deleteAccount: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id } = params;

            if (!id) {
                return fail(400, { error: 'Account ID is required' });
            }

            try {
                // Check if account exists first
                const existingAccount = await locals.prisma.account.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        _count: {
                            select: {
                                companies: true,
                                members: true,
                                devices: true,
                                resources: true
                            }
                        }
                    }
                });

                if (!existingAccount) {
                    return fail(404, { error: 'Account not found' });
                }

                // Check if account has dependencies that would prevent deletion
                const hasCompanies = existingAccount._count.companies > 0;
                const hasMembers = existingAccount._count.members > 0;
                const hasDevices = existingAccount._count.devices > 0;
                const hasResources = existingAccount._count.resources > 0;

                if (hasCompanies || hasMembers || hasDevices || hasResources) {
                    const dependencies = [];
                    if (hasCompanies) dependencies.push(`${existingAccount._count.companies} companies`);
                    if (hasMembers) dependencies.push(`${existingAccount._count.members} members`);
                    if (hasDevices) dependencies.push(`${existingAccount._count.devices} devices`);
                    if (hasResources) dependencies.push(`${existingAccount._count.resources} resources`);

                    return fail(400, { 
                        error: `Cannot delete account with existing dependencies: ${dependencies.join(', ')}. Please remove all dependencies first.` 
                    });
                }

                // Delete the account
                const deletedAccount = await locals.prisma.account.delete({
                    where: { id }
                });

                logger.info(`Account deleted: ${deletedAccount.id} (${deletedAccount.name})`);

                const authSession = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Account',
                    recordId: id,
                    oldData: deletedAccount,
                    newData: null,
                    userId: authSession?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (err) {
                if (err instanceof Error) {
                    logger.error('Error deleting account:', { message: err.message, stack: err.stack });
                } else {
                    logger.error('Error deleting account:', { error: err });
                }
                return fail(500, { error: 'Failed to delete account' });
            }
        },
        [SystemRole.ADMIN]
    )
};
