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
            console.log('Save action triggered');
            logger.info('Save action triggered in admin/users/new');
            
            const form = await superValidate(request, zod(createUserSchema));
            logger.debug('Create user form data:', form);

            if (!form.valid) {
                console.log("Form is invalid")
                return fail(400, { form });
            }

            // Return a structured error response with the form data
            // This ensures the form values are preserved when showing the error
            // Log what we're returning to help with debugging
            const errorResponse = {
                form,
                message: {
                    type: 'error',
                    text: 'Unable to create user at this time',
                    details: 'The system is currently unable to process your request due to a temporary issue. Please try again later or contact support if the problem persists.',
                    code: 'SERVICE_UNAVAILABLE',
                    requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                    timestamp: new Date().toISOString()
                }
            };
            
            console.log('Returning error response:', errorResponse);
            
            return fail(400, errorResponse)

            
           
        },
        ['admin'] // Only allow admin role to create users
    )
};
