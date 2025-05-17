import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { SYSTEM_ROLES, userEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../schema';

/**
 * Load user data for editing
 */
export const load = restrict(
    async ({ params, locals }) => {
        try {
            // Load existing user with account memberships
            const user = await locals.prisma.user.findUnique({
                where: { id: params.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    systemRole: true,
                    status: true,
                    rolesString: true,
                    primaryAccountId: true,
                    createdAt: true,
                    updatedAt: true,
                    accountMemberships: {
                        select: {
                            accountId: true,
                            role: true,
                            account: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            if (!user) {
                return {
                    status: 404,
                    error: 'User not found'
                };
            }

            // Load all accounts for dropdown selection
            const accounts = await locals.prisma.account.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Get current account memberships
            const currentAccountIds = user.accountMemberships.map(m => m.accountId);
            
            // Use the primaryAccountId from the user record if available,
            // otherwise fall back to the first account membership
            const primaryAccountId = user.primaryAccountId || 
                (user.accountMemberships.length > 0 ? user.accountMemberships[0].accountId : null);
            
            // Initialize form with user data
            const form = await superValidate(
                {
                    id: user.id,
                    email: user.email,
                    name: user.name || '',
                    systemRole: user.systemRole,
                    status: user.status || 'ACTIVE',
                    accountIds: currentAccountIds,
                    primaryAccountId: primaryAccountId,
                    rolesString: user.rolesString || '',
                    password: ''
                },
                zod(userEditSchema)
            );

            return {
                user,
                form,
                accounts,
                meta: {
                    roles: SYSTEM_ROLES
                }
            };
        } catch (e) {
            logger.error('Error loading user:', e);
            throw error(500, { message: 'Failed to load user data' });
        }
    },
    [SystemRole.ADMIN],
    {
        redirectTo: '/admin/users',
        message: 'You do not have permission to edit users'
    }
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update user data
     */
    save: restrict(
        async ({ request, params, locals }) => {
            const id = params.id;
            const form = await superValidate(request, zod(userEditSchema));
            logger.debug('Update user form data:', form);

            if (!form.valid) {
                return message(form, {
                    type: 'error',
                    text: 'Please correct the errors in the form'
                }, { status: 400 });
            }

            try {
                // Start a transaction to ensure data consistency
                return await locals.prisma.$transaction(async (tx) => {
                    // First check if user exists
                    const existingUser = await tx.user.findUnique({
                        where: { id }
                    });
                    
                    if (!existingUser) {
                        return message(form, {
                            type: 'error',
                            text: 'User not found'
                        }, { status: 404 });
                    }
                    
                    // Check for duplicate email
                    if (form.data.email !== existingUser.email) {
                        const emailExists = await tx.user.findUnique({
                            where: { email: form.data.email }
                        });
                        
                        if (emailExists) {
                            return message(form, {
                                type: 'error',
                                text: 'Email already in use'
                            }, { status: 409 });
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
                    
                    // Account memberships will be handled separately after user update
                    
                    // Only update password if provided
                    if (form.data.password) {
                        // In a real app, you would hash the password here
                        updateData.password = form.data.password;
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
                            m => m.accountId === form.data.primaryAccountId
                        );
                        
                        if (!existingMembership) {
                            // Create new membership with default role 'MEMBER'
                            await tx.accountMembership.create({
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
                logger.error('Error updating user:', e);
                return message(form, {
                    type: 'error',
                    text: 'Failed to update user. Please try again.'
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN],
        {
            redirectTo: '/admin/users',
            message: 'You do not have permission to update users'
        }
    )
};
