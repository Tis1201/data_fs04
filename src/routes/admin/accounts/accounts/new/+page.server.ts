import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

// Define the account schema
const accountSchema = z.object({
    name: z.string()
        .min(2, { message: "Name must be at least 2 characters" })
        .max(100, { message: "Name must be less than 100 characters" }),
    slug: z.string()
        .min(2, { message: "Slug must be at least 2 characters" })
        .max(50, { message: "Slug must be less than 50 characters" })
        .regex(/^[a-z0-9-]+$/, { message: "Slug can only contain lowercase letters, numbers, and hyphens" }),
    description: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

export const load = restrict(
    async ({ locals }) => {
        // Initialize the account creation form with the schema and defaults
        const form = await superValidate(zod(accountSchema), {
            defaults: {
                name: '',
                slug: '',
                description: '',
                status: 'ACTIVE'
            }
        });

        return {
            form
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for creating a new account using Superforms
    createAccount: async ({ request, locals }) => {
        // Validate the form data against the schema
        const form = await superValidate(request, zod(accountSchema));

        // If validation fails, return the form with errors
        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            // Check if an account with the same slug already exists
            const existingAccount = await locals.prisma.account.findUnique({
                where: { slug: form.data.slug }
            });

            if (existingAccount) {
                return message(form, {
                    type: 'error',
                    text: 'Account with this slug already exists',
                    details: 'Please choose a different slug',
                    code: 'SLUG_EXISTS',
                    timestamp: new Date().toISOString()
                }, { status: 400 });
            }

            // Create the new account
            const account = await locals.prisma.account.create({
                data: {
                    name: form.data.name,
                    slug: form.data.slug,
                    description: form.data.description || null,
                    status: form.data.status
                }
            });

            // Log the account creation
            logger.info(`Account created: ${account.id} (${account.name})`);

            // Return success with the created account
            return { 
                form,
                success: true, 
                account
            };
        } catch (err) {
            logger.error('Error creating account:', err);
            
            return message(form, {
                type: 'error',
                text: 'Failed to create account',
                details: err instanceof Error ? err.message : 'Unknown error',
                code: 'CREATE_FAILED',
                timestamp: new Date().toISOString()
            }, { status: 500 });
        }
    }
};
