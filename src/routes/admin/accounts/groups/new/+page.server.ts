import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { groupSchema } from './group';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load = restrict(
    async ({ locals }) => {
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(groupSchema), {
                id: 'group-form'
            });
            
            // Get all accounts for the dropdown
            const accounts = await locals.prisma.account.findMany({
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
            logger.error(`Error loading group form: ${err}`);
            throw error(500, 'Failed to load group form');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }) => {
            // Validate the form data
            const form = await superValidate(request, zod(groupSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // First, check if the account exists
                const account = await locals.prisma.account.findUnique({
                    where: { id: form.data.accountId }
                });
                
                if (!account) {
                    return fail(400, { 
                        form, 
                        error: 'The selected account does not exist' 
                    });
                }
                
                // Create the group
                const group = await locals.prisma.group.create({
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        permissions: JSON.parse(form.data.permissions),
                        accountId: form.data.accountId
                    }
                });
                
                logger.info(`Group created: ${group.id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Group',
                    recordId: group.id,
                    oldData: null,
                    newData: group,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return { 
                    form,
                    success: true,
                    message: {
                        type: 'success' as const,
                        text: 'Group created successfully',
                        details: `Group '${group.name}' has been created.`
                    }
                };
            } catch (err) {
                logger.error(`Error creating group: ${err}`);
                return fail(500, { 
                    form, 
                    error: 'Failed to create group. Please try again.' 
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
