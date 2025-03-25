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
    allowedFilters: ['roles', 'statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }) => {
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        return {
            users: result.records,
            meta: result.meta
        };
    },
    ['admin'] // Only allow admin role to access this route
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
        ['admin'] // Only allow admin role to create users
    ),
    
    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    deleteUser: restrict(
        async ({ request, locals }) => {
            const data = await request.formData();
            const id = data.get('id')?.toString();
            
            if (!id) {
                return { success: false, error: 'User ID is required' };
            }
            
            // Use the reusable deleteRecord function
            return deleteRecord(locals, 'user', id);
        },
        ['admin'] // Only allow admin role to delete users
    )
};
