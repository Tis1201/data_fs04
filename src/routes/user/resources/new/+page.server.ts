import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../admin/users/schema';
import { logger } from '$lib/server/logger';
import { resourceSchema } from './resource';

export const load = restrict(
    async ({ locals }) => {
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(resourceSchema), {
                id: 'resource-form'
            });
            
            // Get user's accounts for the dropdown
            // Only fetch accounts the user is a member of
            const userAccounts = await locals.prisma.accountMembership.findMany({
                where: {
                    userId: locals.user.id
                },
                select: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            
            const accounts = userAccounts.map(membership => membership.account);
            
            // Get resource types for the dropdown
            const resourceTypes = [
                { value: 'file', label: 'File' },
                { value: 'image', label: 'Image' },
                { value: 'video', label: 'Video' },
                { value: 'document', label: 'Document' }
            ];
            
            return {
                form,
                accounts,
                resourceTypes
            };
        } catch (err) {
            logger.error(`Error loading resource form: ${err}`);
            throw error(500, 'Failed to load resource form');
        }
    },
    [SystemRole.USER] // Allow user role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals }) => {
            // Validate the form data
            const form = await superValidate(request, zod(resourceSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // First, check if the account exists and user has access to it
                const accountMembership = await locals.prisma.accountMembership.findFirst({
                    where: { 
                        userId: locals.user.id,
                        accountId: form.data.accountId
                    }
                });
                
                if (!accountMembership) {
                    return fail(400, { 
                        form, 
                        error: 'You do not have access to the selected account' 
                    });
                }
                
                // Create the resource
                const resource = await locals.prisma.resource.create({
                    data: {
                        name: form.data.name,
                        type: form.data.type,
                        path: form.data.path,
                        size: form.data.size,
                        accountId: form.data.accountId,
                        createdBy: locals.user.id,
                        updatedBy: locals.user.id
                    }
                });
                
                logger.info(`Resource created: ${resource.id}`);
                
                return { 
                    form,
                    success: true,
                    message: {
                        type: 'success' as const,
                        text: 'Resource created successfully',
                        details: `Resource '${resource.name}' has been created.`
                    }
                };
            } catch (err) {
                logger.error(`Error creating resource: ${err}`);
                return fail(500, { 
                    form, 
                    error: 'Failed to create resource. Please try again.' 
                });
            }
        },
        [SystemRole.USER]
    )
};
