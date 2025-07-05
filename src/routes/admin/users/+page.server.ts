import type { PageServerLoad } from './$types';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { superValidate } from 'sveltekit-superforms/server';
import { userSchema } from '$lib/schemas/user';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole, UserStatus } from '$lib/types/roles';
import { getSetting } from '$lib/server/settings/utils';
import { validatePassword } from '$lib/server/auth/password-validation';
import { EmailService } from '$lib/server/email';
import { resetUserPassword } from '$lib/server/services/password-reset';
import prisma from '$lib/server/prisma';

// Define table options for Users
const table_options = {
    modelName: 'user',
    searchableFields: ['email', 'name'],
    allowedFilters: ['systemRoles', 'statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'systemRoles': { field: 'systemRole', operator: 'in' },
        'statuses': { field: 'status', operator: 'in' }
    }
};

// Types for user with count fields
export interface UserWithCount {
    id: string;
    email: string;
    name: string | null;
    systemRole: string;
    status: string;
    rolesString: string;
    createdAt: Date;
    updatedAt: Date;
    _count: {
        accountMemberships: string; // Convert to string for DataTable compatibility
        apiKeys: string;
        devices: string;
    };
}

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }) => {
        console.log('url: ', url)
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        return {
            users: result.records,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
// Schema for password validation
const passwordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters")
});

export const actions = {
    /*******************************************************************************************
     * Create
     ******************************************************************************************/
    create: restrict(
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(userSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const { email, name, role, password } = form.data;

                // Check if user already exists
                const existingUser = await locals.prisma.user.findUnique({
                    where: { email }
                });

                if (existingUser) {
                    return fail(400, {
                        form,
                        error: "User with this email already exists"
                    });
                }

                // Create user
                const userId = generateId(15);
                const hashedPassword = await hash(password);

                const user = await locals.prisma.user.create({
                    data: {
                        id: userId,
                        email,
                        name,
                        role,
                        hashedPassword,
                        status: 'ACTIVE'
                    }
                });

                return { 
                    form,
                    success: true
                };
            } catch (e) {
                logger.error('Error creating user:', e);
                return fail(500, {
                    form,
                    error: "Failed to create user"
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create users
    ),
    
    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    /**
     * Toggle user status (activate/deactivate)
     */
    toggleStatus: restrict(
        async ({ request, locals }) => {
            try {
                // Get the user ID and new status from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const status = data.get('status')?.toString() as UserStatus;

                if (!id) {
                    return fail(400, { error: 'User ID is required' });
                }
                
                if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
                    return fail(400, { error: 'Valid status is required' });
                }
                
                // Get the user to be updated
                const user = await locals.prisma.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        email: true,
                        systemRole: true,
                        status: true
                    }
                });

                if (!user) {
                    return fail(404, { error: 'User not found' });
                }

                // Check if the user is trying to deactivate themselves
                const auth = await locals.auth.validate();
                if (auth?.user?.id === id && status === 'INACTIVE') {
                    return fail(400, {
                        error: 'You cannot deactivate your own account'
                    });
                }

                // Update the user status
                await locals.prisma.user.update({
                    where: { id },
                    data: { status }
                });

                logger.info(`User ${id} status changed to ${status}`);
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling user status: ${err}`);
                return fail(500, { error: 'Failed to update user status' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to toggle user status
    ),

    /**
     * Delete user account
     */
    delete: restrict(
        async ({ request, locals }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'User ID is required' });
                }
                
                // Get the user to be deleted
                const user = await locals.prisma.user.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        email: true,
                        systemRole: true
                    }
                });

                if (!user) {
                    return fail(404, { error: 'User not found' });
                }

                // Check if the user is trying to delete themselves
                const auth = await locals.auth.validate();
                if (auth?.user?.id === id) {
                    return fail(400, {
                        error: 'You cannot delete your own account'
                    });
                }

                const accountMembershipCount = await locals.prisma.accountMembership.count({
                    where: { userId: id }
                });

                if (accountMembershipCount > 0) {
                    return fail(400, {
                        error: `Cannot delete user: This user has ${accountMembershipCount} account membership(s). Please remove them from all accounts first.`
                    });
                }

                await locals.prisma.$transaction(async (tx) => {
                    // Delete invitation tokens (not important)
                    await tx.invitationToken.deleteMany({
                        where: { userId: id }
                    });

                    // Delete sessions (not important)
                    await tx.session.deleteMany({
                        where: { userId: id }
                    });

                    // Finally delete the user
                    await tx.user.delete({
                        where: { id }
                    });
                });;

                logger.info('User deleted successfully:', { userId: id });
                
                return {
                    success: true,
                    message: 'User deleted successfully'
                };

            } catch (e) {
                logger.error('Error deleting user:', e);
                
                // Handle specific Prisma errors
                if (e.code === 'P2003') {
                    return fail(400, {
                        error: 'Cannot delete user: This user has related records that must be removed first. Please deactivate the user instead or contact an administrator.'
                    });
                }
                
                if (e.code === 'P2025') {
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
    ),
    
    /*******************************************************************************************
     * Update Password
     ******************************************************************************************/
    updatePassword: restrict(
        async ({ request, locals }) => {
            try {
                const data = await request.formData();
                const userId = data.get('userId')?.toString();
                const password = data.get('password')?.toString();
                
                if (!userId) {
                    return fail(400, { success: false, message: 'User ID is required' });
                }
                
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
                
                // Get the Zenstack-enhanced Prisma client from locals
                const prisma = locals.prisma;
                
                // Check if the user exists
                const user = await prisma.user.findUnique({
                    where: { id: userId }
                });
                
                if (!user) {
                    return fail(404, { success: false, message: 'User not found' });
                }
                
                // Hash the password using Argon2
                const hashedPassword = await hash(password);
                logger.debug('Password hashed successfully for update', { 
                    userId,
                    passwordLength: password.length 
                });
                
                // Update the user's password
                await prisma.user.update({
                    where: { id: userId },
                    data: { password: hashedPassword }
                });
                
                logger.info(`Password updated for user: ${userId}`);
                
                return { success: true, message: 'Password updated successfully' };
            } catch (e) {
                logger.error('Error updating password:', e as Record<string, any>);
                return fail(500, { success: false, message: 'Failed to update password' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to update passwords
    ),

    /*******************************************************************************************
     * Reset Password
     ******************************************************************************************/
    resetPassword: restrict(
        async ({ request, locals }) => {
            try {
                const data = await request.formData();
                const userId = data.get('userId')?.toString();
                
                if (!userId) {
                    return fail(400, { success: false, message: 'User ID is required' });
                }
                
                // Get the Zenstack-enhanced Prisma client from locals
                const prisma = locals.prisma;
                
                // Check if the user exists
                const user = await prisma.user.findUnique({
                    where: { id: userId },
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
                    prisma: prisma
                });

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
        [SystemRole.ADMIN] // Only allow admin role to reset passwords
    )
};
