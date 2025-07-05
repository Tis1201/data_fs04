/**
 * User Profile Management Server
 * 
 * Handles individual user profile operations within account context:
 * - Load user profile data with account-scoped permissions
 * - Update user profile information
 * - Manage account roles (OWNER/ADMIN/MEMBER)
 * - Password reset functionality with email notifications
 * - Manual password updates for admin users
 * 
 * All operations respect multi-tenant account boundaries and role-based access control.
 */

import {error, fail, type RequestEvent} from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { hash } from '@node-rs/argon2';

import prisma from '$lib/server/prisma';
import { validatePassword } from '$lib/server/auth/password-validation';
import { logger } from '$lib/server/logger';
import { EmailService } from '$lib/server/email';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { restrictAccountRole } from '$lib/server/security/guards';
import type { AccountAuthenticatedEvent, AccountAuthenticatedRouteHandler } from '$lib/server/security/guards';
import { resetUserPassword } from '$lib/server/services/password-reset';
import { canPerformAdminActions } from '$lib/utils/permissions';

export const load: PageServerLoad = async ({ params, locals, cookies }: RequestEvent) => {
    const userId = params.id;
    
    // Get the authentication state
    const auth = await locals.auth.validate();
    if (!auth?.user) {
        throw error(401, 'Unauthorized');
    }

    // Get current account ID from cookie
    const currentAccountId = cookies.get('current_account_id');
    if (!currentAccountId) {
        throw error(400, 'No account selected');
    }

    try {
        // Check if the requested user is a member of the current account
        const targetUserMembership = await prisma.accountMembership.findFirst({
            where: {
                accountId: currentAccountId,
                userId: userId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        systemRole: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                        _count: {
                            select: {
                                sessions: true,
                                accountMemberships: true
                            }
                        }
                    }
                },
                account: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                }
            }
        });

        if (!targetUserMembership) {
            throw error(404, 'User not found in current account');
        }

        // Get current user's membership to check permissions
        const currentUserMembership = await prisma.accountMembership.findFirst({
            where: {
                accountId: currentAccountId,
                userId: auth.user.id
            }
        });

        if (!currentUserMembership) {
            throw error(403, 'Access denied to this account');
        }

        // Transform the data for the frontend
        const userProfile = {
            id: targetUserMembership.user.id,
            email: targetUserMembership.user.email,
            name: targetUserMembership.user.name,
            systemRole: targetUserMembership.user.systemRole,
            status: targetUserMembership.user.status,
            createdAt: targetUserMembership.user.createdAt,
            updatedAt: targetUserMembership.user.updatedAt,
            accountRole: targetUserMembership.role,
            joinedAt: targetUserMembership.createdAt,
            activeSessionsCount: targetUserMembership.user._count.sessions,
            totalAccountsCount: targetUserMembership.user._count.accountMemberships,
            // Additional fields required by PasswordUpdateDialog
            password: '', // Always empty for security
            rolesString: '', // Not used in user context, but required by dialog
            primaryAccountId: null // Not used in user context, but required by dialog
        };

        return {
            user: userProfile,
            currentAccount: {
                id: currentAccountId,
                name: targetUserMembership.account.name,
                userRole: currentUserMembership.role
            },
            canEdit: ['ADMIN', 'OWNER'].includes(currentUserMembership.role) || auth.user.id === userId,
            currentUserId: auth.user.id
        };
    } catch (err) {
        logger.error('Error loading user profile:', { error: err, userId: params.id });
        throw error(500, 'Failed to load user profile');
    }
};

const resetPasswordHandler: AccountAuthenticatedRouteHandler<any> = async ({ 
    request, 
    params, 
    locals, 
    accountMembership 
}) => {
    const { accountId } = accountMembership;
    const id = params.id;
    
    const form = await superValidate(request, zod(z.object({
        // Add any form fields if needed
    })));

    try {
        // Verify the target user exists in the current account
        const targetUserMembership = await prisma.accountMembership.findFirst({
            where: {
                accountId: accountId,
                userId: id
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        if (!targetUserMembership) {
            return message(form, createErrorResponse('User not found in current account'), { status: 404 });
        }

        // Use the new password reset service
        const result = await resetUserPassword({
            userId: targetUserMembership.user.id,
            userEmail: targetUserMembership.user.email,
            userName: targetUserMembership.user.name || targetUserMembership.user.email,
            prisma: prisma
        });

        if (result.success) {
            return message(
                form,
                createSuccessResponse('Password reset successfully', {
                    details: result.details,
                    data: { 
                        email: result.email,
                        messageId: result.messageId
                    }
                })
            );
        } else {
            return message(
                form,
                createErrorResponse('Failed to reset password', { 
                    details: result.message 
                }), 
                { status: 500 }
            );
        }

    } catch (error) {
        return handleFormError({
            error,
            form,
            prisma: prisma,
            requestId: undefined,
            defaultMessage: 'Failed to reset password',
            action: 'password reset'
        });
    }
};

export const actions: Actions = {
    updateProfile: async ({ request, params, locals, cookies }) => {
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            return fail(401, { message: 'Unauthorized' });
        }

        const userId = params.id;
        const currentAccountId = cookies.get('current_account_id');
        if (!currentAccountId) {
            return fail(400, { message: 'No account selected' });
        }

        // Check permissions
        const currentUserMembership = await prisma.accountMembership.findFirst({
            where: {
                accountId: currentAccountId,
                userId: auth.user.id
            }
        });

        const canEdit = currentUserMembership && 
            (['ADMIN', 'OWNER'].includes(currentUserMembership.role) || auth.user.id === userId);

        if (!canEdit) {
            return fail(403, { message: 'Insufficient permissions' });
        }

        try {
            const data = await request.formData();
            const name = data.get('name') as string;
            const email = data.get('email') as string;

            if (!name || !email) {
                return fail(400, { message: 'Name and email are required' });
            }

            // Update user profile
            await prisma.user.update({
                where: { id: userId },
                data: { 
                    name: name.trim(),
                    email: email.trim().toLowerCase()
                }
            });

            return {
                type: 'success',
                message: 'Profile updated successfully'
            };
        } catch (err) {
            logger.error('Error updating profile:', { error: err, userId: params.id });
            return fail(500, { message: 'Failed to update profile' });
        }
    },

    updateAccountRole: restrictAccountRole(
        async ({ request, params, locals, accountMembership }: AccountAuthenticatedEvent) => {
            try {
                const { accountId } = accountMembership;

                // Get form data
                const data = await request.formData();
                const newRole = data.get('role') as string;

                // Validate role
                const validRoles = ['OWNER', 'ADMIN', 'MEMBER'];
                if (!validRoles.includes(newRole)) {
                    return fail(400, { message: 'Invalid role specified' });
                }

                // Prevent users from removing themselves from owner/admin roles if they're the only one
                if (params.id === accountMembership.userId && ['OWNER', 'ADMIN'].includes(accountMembership.role)) {
                    const adminCount = await prisma.accountMembership.count({
                        where: {
                            accountId: accountId,
                            role: { in: ['OWNER', 'ADMIN'] }
                        }
                    });

                    if (adminCount <= 1 && newRole === 'MEMBER') {
                        return fail(400, { message: 'Cannot remove the last admin from the account' });
                    }
                }

                // Update the account membership role
                const updatedMembership = await prisma.accountMembership.update({
                    where: {
                        userId_accountId: {
                            userId: params.id,
                            accountId: accountId
                        }
                    },
                    data: {
                        role: newRole
                    }
                });

                logger.info('Account role updated successfully', { 
                    userId: params.id, 
                    newRole: updatedMembership.role,
                    updatedBy: accountMembership.userId 
                });

                return {
                    status: 200,
                    message: 'Role updated successfully'
                };

            } catch (error) {
                logger.error('Failed to update account role:', { error, userId: params.id });
                return fail(500, { message: 'Failed to update role' });
            }
        },
        ['ADMIN', 'OWNER'] // Only allow account admins and owners
    ),

    resetPassword: restrictAccountRole(resetPasswordHandler, ['ADMIN', 'OWNER']),

    updatePassword: restrictAccountRole(
        async ({ request, params, locals, accountMembership }: AccountAuthenticatedEvent) => {
            const id = params.id;
            
            // Add debugging logs
            console.log('=== UPDATE PASSWORD DEBUG START ===');
            console.log('Target user ID from params:', id);
            console.log('Account ID from membership:', accountMembership.accountId);
            console.log('Current user ID:', accountMembership.userId);
            console.log('Current user role:', accountMembership.role);
            console.log('=== UPDATE PASSWORD DEBUG END ===');
            
            // Define the schema for password update validation
            const passwordUpdateSchema = z.object({
                password: z.string().min(1, 'Password is required')
            });
            
            // Validate the form data using SuperForm
            const form = await superValidate(request, zod(passwordUpdateSchema));
            
            // If validation fails, return the form with errors
            if (!form.valid) {
                return message(form, createErrorResponse('Please correct the errors in the form'), { status: 400 });
            }
            
            try {
                // Account membership and permissions are already validated by restrictAccountRole
                const { accountId } = accountMembership;

                // Ensure password exists (should be guaranteed by schema validation)
                const password = form.data.password as string;
                if (!password) {
                    return message(form, createErrorResponse('Password is required'), { status: 400 });
                }

                // Validate password based on settings
                const passwordValidation = await validatePassword(password);
                if (!passwordValidation.valid) {
                    return message(form, createErrorResponse(passwordValidation.error || 'Password validation failed'), { status: 400 });
                }

                // Add more specific debugging for the query
                console.log('=== QUERY DEBUG ===');
                console.log('Querying with accountId:', accountId);
                console.log('Querying with userId:', id);
                
                // Verify the target user exists in the current account
                const targetUserMembership = await prisma.accountMembership.findFirst({
                    where: {
                        accountId: accountId,
                        userId: id
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true
                            }
                        }
                    }
                });

                console.log('Query result:', targetUserMembership);

                if (!targetUserMembership) {
                    // Let's also check if the user exists at all in this account
                    const allMemberships = await prisma.accountMembership.findMany({
                        where: { accountId: accountId },
                        select: { userId: true, role: true }
                    });
                    console.log('All memberships in account:', allMemberships);
                    
                    // Also check if the user exists anywhere
                    const userExists = await prisma.user.findUnique({
                        where: { id: id },
                        select: { id: true, email: true }
                    });
                    console.log('User exists in system:', userExists);
                    
                    return message(form, createErrorResponse('User not found in current account'), { status: 404 });
                }
                
                // Hash the password using Argon2
                const hashedPassword = await hash(form.data.password);
                logger.debug('Password hashed successfully for update', { 
                    userId: id,
                    passwordLength: form.data.password.length 
                });

                // Update the user's password
                await prisma.user.update({
                    where: { id },
                    data: { password: hashedPassword }
                });

                logger.info(`Password updated for user: ${id} (${targetUserMembership.user.email})`);

                return message(
                    form,
                    createSuccessResponse('Password updated successfully', {
                        details: `Password updated successfully for ${targetUserMembership.user.name || targetUserMembership.user.email}.`
                    })
                );

            } catch (error) {
                console.log('Error in updatePassword:', error);
                return handleFormError({
                    error,
                    form,
                    prisma: prisma,
                    requestId: undefined,
                    defaultMessage: 'Failed to update password',
                    action: 'password update'
                });
            }
        },
        ['ADMIN', 'OWNER'] // Only allow account admins and owners
    )
}; 
