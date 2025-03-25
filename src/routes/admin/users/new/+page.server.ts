import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { createUserSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';

export const load = (async ({ locals }) => {
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        throw error(403, 'Not authorized to create users');
    }
    
    // Initialize the form with the schema and defaults
    const form = await superValidate(zod(createUserSchema), {
        defaults: {
            email: '',
            name: '',
            role: 'USER',
            status: 'ACTIVE'
        }
    });
    
    return { form };
}) satisfies PageServerLoad;

export const actions = {
    /**
     * Save new user data
     */
    save: restrict(
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(createUserSchema));
            logger.debug('Create user form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            // throw new Error("This is a test server error to verify the error handling in the UI");
            // Test error for error display testing
            // return fail(500, { 
            //     form,
            //     error: {
            //         code: 'SERVER_ERROR',
            //         message: 'This is a test server error to verify the error handling in the UI',
            //         details: 'Additional error details would appear here. For example: The database connection failed or a required service is unavailable.',
            //         timestamp: new Date().toISOString(),
            //         requestId: `req-${Math.random().toString(36).substring(2, 15)}`
            //     }
            // });


            try {
                // Create new user
                await locals.prisma.user.create({
                    data: {
                        email: form.data.email,
                        name: form.data.name || "",
                        systemRole: form.data.role,
                        status: form.data.status,
                        rolesString: form.data.role.toLowerCase(),
                        // Set a temporary password that must be changed on first login
                        password: form.data.password || 'ChangeMe123!'
                    }
                });
                
                logger.info('User created successfully');
                
                return {
                    form,
                    success: true
                };
            } catch (e) {
                logger.error('Error creating user:', e);
                return fail(500, {
                    form,
                    error: 'Failed to create user'
                });
            }
        },
        ['admin'] // Only allow admin role to create users
    )
};
