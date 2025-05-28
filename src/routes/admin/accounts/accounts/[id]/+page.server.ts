import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
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
    async ({ params, locals }) => {
        const { id } = params;
        
        // Fetch the account by ID
        const account = await locals.prisma.account.findUnique({
            where: { id }
        });
        
        // If account doesn't exist, throw a 404 error
        if (!account) {
            throw error(404, {
                message: 'Account not found',
                code: 'ACCOUNT_NOT_FOUND'
            });
        }
        
        // Initialize the form with the account data
        const form = await superValidate(
            {
                name: account.name,
                slug: account.slug,
                description: account.description || '',
                status: account.status
            }, 
            zod(accountSchema)
        );

        return {
            form,
            account
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for updating an account using Superforms
    updateAccount: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            
            // Validate the form data against the schema
            const form = await superValidate(request, zod(accountSchema));

            // If validation fails, return the form with errors
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if the account exists
                const existingAccount = await locals.prisma.account.findUnique({
                    where: { id }
                });

                if (!existingAccount) {
                    return message(form, {
                        type: 'error',
                        text: 'Account not found',
                        code: 'ACCOUNT_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }
                
                // Check if another account with the same slug exists (excluding current account)
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
                            code: 'SLUG_EXISTS',
                            timestamp: new Date().toISOString()
                        }, { status: 400 });
                    }
                }

                // Update the account
                const account = await locals.prisma.account.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        slug: form.data.slug,
                        description: form.data.description || null,
                        status: form.data.status
                    }
                });

                // Log the account update
                logger.info(`Account updated: ${account.id} (${account.name})`);

                // Return success with the updated account
                return { 
                    form,
                    success: true, 
                    account
                };
            } catch (err) {
                logger.error('Error updating account:', err);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to update account',
                    details: err instanceof Error ? err.message : 'Unknown error',
                    code: 'UPDATE_FAILED',
                    timestamp: new Date().toISOString()
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    )
};
