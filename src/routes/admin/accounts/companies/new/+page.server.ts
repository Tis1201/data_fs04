import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

// Define the company schema
const companySchema = z.object({
    name: z.string()
        .min(2, { message: "Name must be at least 2 characters" })
        .max(100, { message: "Name must be less than 100 characters" }),
    status: z.string().optional(),
    address: z.string().optional(),
    contactEmail: z.string().email({ message: "Invalid email address" }).optional(),
    contactPhone: z.string().optional(),
    description: z.string().optional(),
    accountId: z.string().min(1, { message: "Account is required" })
});

export const load = restrict(
    async ({ locals }) => {
        // Get all accounts for the dropdown
        const accounts = await locals.prisma.account.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Initialize the company creation form with the schema and defaults
        const form = await superValidate(zod(companySchema), {
            defaults: {
                name: '',
                status: 'ACTIVE',
                address: '',
                contactEmail: '',
                contactPhone: '',
                description: '',
                accountId: ''
            }
        });

        return {
            form,
            accounts
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions = {
    // Action for creating a new company using Superforms
    createCompany: restrict(
        async ({ request, locals }) => {
            // Validate the form data against the schema
            const form = await superValidate(request, zod(companySchema));

            // If validation fails, return the form with errors
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if the account exists
                const account = await locals.prisma.account.findUnique({
                    where: { id: form.data.accountId }
                });

                if (!account) {
                    return message(form, {
                        type: 'error',
                        text: 'Selected account does not exist',
                        code: 'ACCOUNT_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 400 });
                }

                // Create the new company
                const company = await locals.prisma.company.create({
                    data: {
                        name: form.data.name,
                        status: form.data.status || 'ACTIVE',
                        address: form.data.address || null,
                        contactEmail: form.data.contactEmail || null,
                        contactPhone: form.data.contactPhone || null,
                        description: form.data.description || null,
                        accountId: form.data.accountId
                    }
                });

                // Log the company creation
                logger.info(`Company created: ${company.id} (${company.name})`);

                // Return success with the created company
                return { 
                    form,
                    success: true, 
                    company
                };
            } catch (err) {
                logger.error('Error creating company:', err);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to create company',
                    details: err instanceof Error ? err.message : 'Unknown error',
                    code: 'CREATE_FAILED',
                    timestamp: new Date().toISOString()
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    )
};
