import type { PageServerLoad } from './$types';
import type { UserStatus } from '@prisma/client';
import { error, fail, json } from '@sveltejs/kit';
import { generateId } from 'lucia';
import { hash } from '@node-rs/argon2';
import { superValidate } from 'sveltekit-superforms/server';
import { userSchema } from '$lib/schemas/user';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';

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
    ['ADMIN'] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
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
        ['ADMIN'] // Only allow admin role to create users
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
        ['ADMIN'] // Only allow admin role to toggle user status
    ),

    /**
     * Delete user account
     */
    delete: restrict(
        async ({ request, locals }) => {
            try {
                // Get the user ID from form data
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

                // Delete the user
                await locals.prisma.user.delete({
                    where: { id }
                });

                logger.info('User deleted successfully:', { userId: id });
                
                // Return success response
                return {
                    success: true,
                    message: 'User deleted successfully'
                };

            } catch (e) {
                logger.error('Error deleting user:', e);
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
        ['ADMIN'] // Only allow admin role to delete users
    )
};
