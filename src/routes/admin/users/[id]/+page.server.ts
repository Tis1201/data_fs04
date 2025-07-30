import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { SYSTEM_ROLES, userEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { hash } from '@node-rs/argon2';
import { validatePassword } from '$lib/server/auth/password-validation';
import type { PrismaClient } from '@prisma/client';
import { EmailService } from '$lib/server/email';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { resetUserPassword } from '$lib/server/services/password-reset';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * Load user data for editing
 */
export const load = restrict(
    async ({ params, locals }: { params: any; locals: any }) => {
        const id = params.id;
        
        try {
            // Fetch user data with detailed account memberships and companies
            const user = await locals.prisma.user.findUnique({
                where: { id },
                include: {
                    accountMemberships: {
                        include: {
                            account: {
                                include: {
                                    companies: {
                                        select: {
                                            id: true,
                                            name: true,
                                            status: true,
                                            contactEmail: true,
                                            createdAt: true,
                                            updatedAt: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!user) {
                throw error(404, 'User not found');
            }

            // Get all accounts for the primary account dropdown and for adding memberships
            const allAccounts = await locals.prisma.account.findMany({
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                },
                orderBy: { name: 'asc' }
            });

            // Format account memberships for RelationshipSection
            const accountMemberships = user.accountMemberships.map((membership: any) => ({
                id: membership.account.id,
                name: membership.account.name,
                status: membership.account.status,
                role: membership.role,
                createdAt: membership.account.createdAt,
                updatedAt: membership.account.updatedAt,
                // Additional display info
                membershipId: membership.id,
                membershipRole: membership.role
            }));

            // Get all companies from accounts the user is a member of
            const userCompanies = user.accountMemberships
                .flatMap((membership: any) => membership.account.companies)
                .filter((company: any, index: number, self: any[]) => 
                    index === self.findIndex((c: any) => c.id === company.id)
                ); // Remove duplicates

            // Get available accounts for adding (exclude current memberships)
            const currentAccountIds = new Set(user.accountMemberships.map((m: any) => m.account.id));
            const availableAccounts = allAccounts
                .filter((account: any) => !currentAccountIds.has(account.id))
                .map((account: any) => ({
                    id: account.id,
                    name: account.name,
                    status: account.status,
                    createdAt: account.createdAt,
                    updatedAt: account.updatedAt
                }));

            // Create form with user data
            const form = await superValidate({
                email: user.email,
                name: user.name || '',
                systemRole: user.systemRole,
                status: user.status,
                rolesString: user.rolesString || '',
                primaryAccountId: user.primaryAccountId || '',
                password: '' // Always empty for security
            }, zod(userEditSchema));

            return {
                form,
                user,
                accounts: allAccounts,
                systemRoles: SYSTEM_ROLES,
                // Relationship data
                relationships: {
                    accounts: accountMemberships,
                    companies: userCompanies
                },
                availableAccounts
            };
        } catch (err) {
            logger.error('Error loading user edit page:', err as Record<string, any>);
            throw error(500, 'Failed to load user data');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update user data
     */
    update: restrict(
        async ({ request, params, locals }: { request: Request; params: any; locals: any }) => {
            const id = params.id;
            
            const form = await superValidate(request, zod(userEditSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Use a transaction to ensure data consistency
                await locals.prisma.$transaction(async (tx: any) => {
                    // First check if user exists
                    const existingUser = await tx.user.findUnique({
                        where: { id },
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            systemRole: true,
                            status: true,
                            rolesString: true,
                            accountMemberships: {
                                include: {
                                    account: true
                                }
                            }
                        }
                    });

                    if (!existingUser) {
                        throw new Error('User not found');
                    }

                    // Check if email is being changed and if it conflicts with another user
                    if (form.data.email !== existingUser.email) {
                        const emailConflict = await tx.user.findUnique({
                            where: { email: form.data.email },
                            select: { id: true }
                        });

                        if (emailConflict && emailConflict.id !== id) {
                            throw new Error('A user with this email already exists');
                        }
                    }
                    
                    // Prepare update data
                    const updateData: Record<string, any> = {
                        email: form.data.email,
                        name: form.data.name || null,
                        systemRole: form.data.systemRole,
                        status: form.data.status,
                        rolesString: form.data.rolesString,
                        // Set primary account directly in the user record
                        primaryAccountId: form.data.primaryAccountId || null,
                        updatedAt: new Date()
                    };
                    
                    // Only update password if provided
                    if (form.data.password) {
                        // Validate password based on settings
                        const passwordValidation = await validatePassword(form.data.password);
                        if (!passwordValidation.valid) {
                            return message(form, {
                                type: 'error',
                                text: 'Password validation failed',
                                details: passwordValidation.error
                            }, { status: 400 });
                        }
                        
                        // Hash the password using Argon2
                        updateData.password = await hash(form.data.password);
                    }
                    
                    // Update user
                    const updatedUser = await tx.user.update({
                        where: { id },
                        data: updateData,
                        select: {
                            id: true,
                            email: true,
                            name: true,
                            systemRole: true,
                            status: true,
                            rolesString: true,
                            createdAt: true,
                            updatedAt: true,
                            accountMemberships: {
                                select: {
                                    accountId: true,
                                    role: true
                                }
                            }
                        }
                    });

                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'User',
                        recordId: id,
                        oldData: existingUser,
                        newData: updatedUser,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: tx
                    })
                    
                    // Store the primary account ID for form update
                    const primaryAccountId = form.data.primaryAccountId;
                    
                    // Handle primary account membership
                    if (form.data.primaryAccountId) {
                        // Log for debugging
                        logger.info('Processing primary account:', { 
                            primaryAccountId: form.data.primaryAccountId,
                            existingMemberships: updatedUser.accountMemberships 
                        });
                        
                        // Check if user already has membership in this account
                        const existingMembership = updatedUser.accountMemberships.find(
                            (m: any) => m.accountId === form.data.primaryAccountId
                        );
                        
                        if (!existingMembership) {
                            // Create new membership with default role 'MEMBER'
                            const membership = await tx.accountMembership.create({
                                data: {
                                    userId: id,
                                    accountId: form.data.primaryAccountId,
                                    role: 'MEMBER'
                                }
                            });
                            
                            logger.info('Created new account membership', { 
                                userId: id, 
                                accountId: form.data.primaryAccountId 
                            });

                            await logAudit({
                                actionType: AuditActionType.INSERT,
                                tableName: 'AccountMembership',
                                recordId: membership.id,
                                oldData: null,
                                newData: membership,
                                userId: locals.user.id,
                                ipAddress: locals.ipAddress,
                                prisma: tx
                            })
                        }
                        
                        // Update the user's primaryAccountId directly
                        await tx.user.update({
                            where: { id },
                            data: {
                                primaryAccountId: form.data.primaryAccountId
                            }
                        });
                        
                        logger.info('Updated user primary account', {
                            userId: id,
                            primaryAccountId: form.data.primaryAccountId
                        });
                    } else {
                        // Clear the primary account if none is selected
                        await tx.user.update({
                            where: { id },
                            data: {
                                primaryAccountId: null
                            }
                        });
                        
                        logger.info('Cleared user primary account', { userId: id });
                    }
                    
                    logger.info('User updated successfully', { userId: id, primaryAccountId });
                    
                    // Create a new form with the updated data including primaryAccountId
                    const updatedFormData = {
                        ...form.data,
                        primaryAccountId: primaryAccountId || null
                    };
                    
                    // Create a new validated form
                    const updatedForm = await superValidate(updatedFormData, zod(userEditSchema));
                    
                    return message(updatedForm, {
                        type: 'success',
                        text: 'User updated successfully'
                    });
                });
            } catch (e) {
                logger.error('Error updating user:', e as Record<string, any>);
                return message(form, {
                    type: 'error',
                    text: 'Failed to update user. Please try again.'
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Update Password
     ******************************************************************************************/
    updatePassword: restrict(
        async ({ request, params, locals }: { request: Request; params: any; locals: any }) => {
            const id = params.id;
            
            try {
                const formData = await request.formData();
                const password = formData.get('password')?.toString();
                
                if (!password) {
                    return fail(400, { success: false, message: 'Password is required' });
                }
                
                // Validate password based on settings
                const passwordValidation = await validatePassword(password);
                if (!passwordValidation.valid) {
                    return fail(400, { 
                        success: false, 
                        message: passwordValidation.error
                    });
                }
                
                // Check if the user exists
                const user = await locals.prisma.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        email: true
                    }
                });
                
                if (!user) {
                    return fail(404, { success: false, message: 'User not found' });
                }
                
                // Hash the password using Argon2
                const hashedPassword = await hash(password);
                logger.debug('Password hashed successfully for update', { 
                    userId: id,
                    passwordLength: password.length 
                });
                
                // Update the user's password
                await locals.prisma.user.update({
                    where: { id },
                    data: { password: hashedPassword }
                });
                
                logger.info(`Password updated for user: ${id} (${user.email})`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'User',
                    recordId: user.id,
                    oldData: null,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma,
                    changeSummary: "Update Password"
                })
                
                return { success: true, message: 'Password updated successfully' };
            } catch (e) {
                logger.error('Error updating password:', e as Record<string, any>);
                return fail(500, { success: false, message: 'Failed to update password' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Reset Password
     ******************************************************************************************/
    resetPassword: restrict(
        async ({ request, params, locals }: { request: Request; params: any; locals: any }) => {
            const id = params.id;
            
            try {
                // Check if the user exists
                const user = await locals.prisma.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                });
                
                if (!user) {
                    return fail(404, { success: false, message: 'User not found' });
                }

                // Use the new password reset service
                const result = await resetUserPassword({
                    userId: user.id,
                    userEmail: user.email,
                    userName: user.name || user.email,
                    prisma: locals.prisma
                });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'User',
                    recordId: user.id,
                    oldData: null,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma,
                    changeSummary: "Reset Password"
                })

                if (result.success) {
                    return {
                        success: true,
                        message: result.message,
                        details: result.details,
                        email: result.email,
                        messageId: result.messageId
                    };
                } else {
                    return fail(500, { 
                        success: false, 
                        message: result.message 
                    });
                }

            } catch (error) {
                logger.error('Error resetting password:', error as Record<string, any>);
                return fail(500, { success: false, message: 'Failed to reset password' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Add Account Membership
     ******************************************************************************************/
    addAccount: restrict(
        async ({ request, params, locals }: { request: Request; params: any; locals: any }) => {
            const userId = params.id;
            
            try {
                const formData = await request.formData();
                const itemIdString = formData.get('itemId')?.toString();
                
                if (!itemIdString) {
                    return fail(400, { success: false, message: 'Account ID is required' });
                }

                let accountIds: string[];
                try {
                    accountIds = JSON.parse(itemIdString);
                    if (!Array.isArray(accountIds)) {
                        accountIds = [itemIdString];
                    }
                } catch {
                    accountIds = [itemIdString];
                }

                // Check if user exists
                const user = await locals.prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, email: true }
                });

                if (!user) {
                    return fail(404, { success: false, message: 'User not found' });
                }

                // Use transaction to add memberships
                await locals.prisma.$transaction(async (tx: PrismaClient) => {
                    for (const accountId of accountIds) {
                        // Check if account exists
                        const account = await tx.account.findUnique({
                            where: { id: accountId },
                            select: { id: true, name: true }
                        });

                        if (!account) {
                            throw new Error(`Account not found: ${accountId}`);
                        }

                        // Check if membership already exists
                        const existingMembership = await tx.accountMembership.findUnique({
                            where: {
                                userId_accountId: {
                                    userId,
                                    accountId
                                }
                            }
                        });

                        if (existingMembership) {
                            logger.warn(`User ${userId} is already a member of account ${accountId}`);
                            continue;
                        }

                        // Create membership
                        const membership = await tx.accountMembership.create({
                            data: {
                                userId,
                                accountId,
                                role: 'MEMBER' // Default role
                            }
                        });

                        logger.info(`Added user ${userId} to account ${accountId} as MEMBER`);

                        await logAudit({
                            actionType: AuditActionType.INSERT,
                            tableName: 'AccountMembership',
                            recordId: membership.id,
                            oldData: null,
                            newData: membership,
                            userId: locals.user.id,
                            ipAddress: locals.ipAddress,
                            prisma: tx
                        })
                    }
                });

                return { success: true, message: 'Account membership(s) added successfully' };
            } catch (e) {
                logger.error('Error adding account membership:', e as Record<string, any>);
                return fail(500, { success: false, message: 'Failed to add account membership' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Remove Account Membership
     ******************************************************************************************/
    removeAccount: restrict(
        async ({ request, params, locals }: { request: Request; params: any; locals: any }) => {
            const userId = params.id;
            
            try {
                const formData = await request.formData();
                const accountId = formData.get('itemId')?.toString();
                
                if (!accountId) {
                    return fail(400, { success: false, message: 'Account ID is required' });
                }

                // Check if user exists
                const user = await locals.prisma.user.findUnique({
                    where: { id: userId },
                    select: { 
                        id: true, 
                        email: true,
                        primaryAccountId: true
                    }
                });

                if (!user) {
                    return fail(404, { success: false, message: 'User not found' });
                }

                // Use transaction to remove membership and handle primary account
                await locals.prisma.$transaction(async (tx: PrismaClient) => {
                    // Check if membership exists
                    const membership = await tx.accountMembership.findUnique({
                        where: {
                            userId_accountId: {
                                userId,
                                accountId
                            }
                        },
                        include: {
                            account: {
                                select: { name: true }
                            }
                        }
                    });

                    if (!membership) {
                        throw new Error('Account membership not found');
                    }

                    // Remove the membership
                    await tx.accountMembership.delete({
                        where: {
                            userId_accountId: {
                                userId,
                                accountId
                            }
                        }
                    });

                    // If this was the user's primary account, clear it
                    if (user.primaryAccountId === accountId) {
                        await tx.user.update({
                            where: { id: userId },
                            data: { primaryAccountId: null }
                        });
                        logger.info(`Cleared primary account for user ${userId} since membership was removed`);

                        await logAudit({
                            actionType: AuditActionType.UPDATE,
                            tableName: 'User',
                            recordId: userId,
                            oldData: { primaryAccountId: accountId },
                            newData: { primaryAccountId: null },
                            userId: locals.user.id,
                            ipAddress: locals.ipAddress,
                            prisma: tx
                        })
                    }

                    logger.info(`Removed user ${userId} from account ${accountId} (${membership.account.name})`);

                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'AccountMembership',
                        recordId: membership.id,
                        oldData: membership,
                        newData: null,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: tx
                    })
                });

                return { success: true, message: 'Account membership removed successfully' };
            } catch (e) {
                logger.error('Error removing account membership:', e as Record<string, any>);
                return fail(500, { success: false, message: 'Failed to remove account membership' });
            }
        },
        [SystemRole.ADMIN]
    ),

    /*******************************************************************************************
     * Delete User
     ******************************************************************************************/
    deleteUser: restrict(
        async ({ request, params, locals }: { request: Request; params: any; locals: any }) => {
            const id = params.id;

            if (!id) {
                return fail(400, { error: 'User ID is required' });
            }

            try {
                logger.info(`Starting user deletion process for ID: ${id}`);

                // Get the user to be deleted
                const user = await locals.prisma.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        systemRole: true
                    }
                });

                if (!user) {
                    logger.warn(`User not found: ${id}`);
                    return fail(404, { error: 'User not found' });
                }

                logger.info(`Found user: ${user.email} (${user.id})`);

                // Check if the user is trying to delete themselves
                if (locals.user?.id === id) {
                    return fail(400, {
                        error: 'You cannot delete your own account'
                    });
                }

                // Check for critical dependencies that prevent deletion
                const accountMembershipCount = await locals.prisma.accountMembership.count({
                    where: { userId: id }
                });

                if (accountMembershipCount > 0) {
                    const errorMsg = `Cannot delete user: This user has ${accountMembershipCount} account membership(s). Please remove them from all accounts first.`;
                    logger.warn(`Deletion blocked for user ${id}: ${errorMsg}`);
                    return fail(400, { error: errorMsg });
                }

                logger.info(`No critical dependencies found, proceeding with deletion of user: ${id}`);

                // Use transaction to delete related records and then the user
                await locals.prisma.$transaction(async (tx) => {
                    // Delete invitation tokens (not critical)
                    await tx.invitationToken.deleteMany({
                        where: { userId: id }
                    });

                    // Delete sessions (not critical)
                    await tx.session.deleteMany({
                        where: { userId: id }
                    });

                    // Delete API keys (not critical)
                    await tx.apiKey.deleteMany({
                        where: { userId: id }
                    });

                    // Delete refresh tokens (not critical)
                    await tx.refreshToken.deleteMany({
                        where: { userId: id }
                    });

                    // Finally delete the user
                    await tx.user.delete({
                        where: { id }
                    });
                });

                logger.info(`User successfully deleted: ${user.id} (${user.email})`);

                // Audit logging with better error handling
                try {
                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'User',
                        recordId: id,
                        oldData: user,
                        newData: null,
                        userId: locals.user?.id || 'unknown',
                        ipAddress: locals.ipAddress || 'unknown',
                        prisma: locals.prisma
                    });
                    logger.info(`Audit log entry created for user deletion: ${id}`);
                } catch (auditError) {
                    // Don't fail the deletion if audit logging fails
                    logger.error('Failed to create audit log entry:', auditError as Record<string, any>);
                }

                logger.info(`User deletion completed successfully: ${id}`);
                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                const stackTrace = err instanceof Error ? err.stack : undefined;
                
                logger.error(`Error deleting user ${id}:`, { 
                    message: errorMsg, 
                    stack: stackTrace,
                    userId: id
                });
                
                // Handle specific Prisma errors (same as list page)
                if (err.code === 'P2003') {
                    return fail(400, {
                        error: 'Cannot delete user: This user has related records that must be removed first. Please deactivate the user instead or contact an administrator.'
                    });
                }
                
                if (err.code === 'P2025') {
                    return fail(404, {
                        error: 'User not found'
                    });
                }
                
                return fail(500, {
                    error: 'Failed to delete user'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
