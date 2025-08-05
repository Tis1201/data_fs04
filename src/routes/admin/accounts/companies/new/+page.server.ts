import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { companySchema } from './company';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';



export const load = restrict(
    async ({ locals }) => {
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(companySchema), {
                id: 'company-form'
            });
            
            // Get all accounts for the dropdown
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
            
            return {
                form,
                accounts
            };
        } catch (err) {
            logger.error(`Error loading company form: ${err}`);
            throw error(500, 'Failed to load company form');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }) => {
            // Validate the form data
            const form = await superValidate(request, zod(companySchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Create the company
                const company = await locals.prisma.company.create({
                    data: {
                        name: form.data.name,
                        status: form.data.status,
                        address: form.data.address,
                        contactEmail: form.data.contactEmail,
                        contactPhone: form.data.contactPhone,
                        description: form.data.description,
                        accountId: form.data.accountId
                    }
                });
                
                logger.info(`Company created: ${company.id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Company',
                    recordId: company.id,
                    oldData: null,
                    newData: company,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return { 
                    form,
                    success: true,
                    message: {
                        type: 'success' as const,
                        text: 'Company created successfully',
                        details: `Company '${company.name}' has been created.`
                    }
                };
            } catch (err) {
                logger.error(`Error creating company: ${err}`);
                return fail(500, { 
                    form, 
                    error: 'Failed to create company. Please try again.' 
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
