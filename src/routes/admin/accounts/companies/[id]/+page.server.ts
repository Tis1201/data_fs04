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
    async ({ params, locals }) => {
        const { id } = params;
        
        try {
            // Fetch the company by ID
            const company = await locals.prisma.company.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            
            // If company doesn't exist, throw a 404 error
            if (!company) {
                throw error(404, {
                    message: 'Company not found',
                    code: 'COMPANY_NOT_FOUND'
                });
            }
            
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
            
            // Initialize the form with the company data
            const form = await superValidate(
                {
                    name: company.name,
                    status: company.status || 'ACTIVE',
                    address: company.address || '',
                    contactEmail: company.contactEmail || '',
                    contactPhone: company.contactPhone || '',
                    description: company.description || '',
                    accountId: company.accountId
                }, 
                zod(companySchema)
            );

            return {
                form,
                company,
                accounts
            };
        } catch (err) {
            if (err.status === 404) {
                throw err;
            }
            logger.error('Error loading company:', err);
            throw error(500, 'Failed to load company details');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for updating a company using Superforms
    updateCompany: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            
            // Validate the form data against the schema
            const form = await superValidate(request, zod(companySchema));

            // If validation fails, return the form with errors
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if the company exists
                const existingCompany = await locals.prisma.company.findUnique({
                    where: { id }
                });

                if (!existingCompany) {
                    return message(form, {
                        type: 'error',
                        text: 'Company not found',
                        code: 'COMPANY_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }
                
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

                // Update the company
                const company = await locals.prisma.company.update({
                    where: { id },
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

                // Log the company update
                logger.info(`Company updated: ${company.id} (${company.name})`);

                // Return success with the updated company
                return { 
                    form,
                    success: true, 
                    company
                };
            } catch (err) {
                logger.error('Error updating company:', err);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to update company',
                    details: err instanceof Error ? err.message : 'Unknown error',
                    code: 'UPDATE_FAILED',
                    timestamp: new Date().toISOString()
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    )
};
