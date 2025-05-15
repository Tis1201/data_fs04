import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { groupSchema } from '../../groups/new/group';

export const load = restrict(
    async ({ params, locals }) => {
        const { id } = params;
        
        try {
            // Fetch the group by ID
            const group = await locals.prisma.group.findUnique({
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
            
            // If group doesn't exist, throw a 404 error
            if (!group) {
                throw error(404, {
                    message: 'Group not found',
                    code: 'GROUP_NOT_FOUND'
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
            
            // Initialize the form with the group data
            const form = await superValidate(
                {
                    name: group.name,
                    description: group.description || '',
                    permissions: typeof group.permissions === 'object' 
                        ? JSON.stringify(group.permissions) 
                        : group.permissions || '{}',
                    accountId: group.accountId
                }, 
                zod(groupSchema)
            );

            return {
                form,
                group,
                accounts
            };
        } catch (err) {
            if (err.status === 404) {
                throw err;
            }
            logger.error('Error loading group:', err);
            throw error(500, 'Failed to load group details');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for updating a group using Superforms
    updateGroup: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            
            // Validate the form data against the schema
            const form = await superValidate(request, zod(groupSchema));

            // If validation fails, return the form with errors
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Check if the group exists
                const existingGroup = await locals.prisma.group.findUnique({
                    where: { id }
                });

                if (!existingGroup) {
                    return message(form, {
                        type: 'error',
                        text: 'Group not found',
                        code: 'GROUP_NOT_FOUND',
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

                // Parse permissions to ensure it's valid JSON
                let parsedPermissions;
                try {
                    parsedPermissions = JSON.parse(form.data.permissions || '{}');
                } catch (err) {
                    return message(form, {
                        type: 'error',
                        text: 'Invalid permissions format',
                        details: 'Permissions must be a valid JSON object',
                        code: 'INVALID_PERMISSIONS',
                        timestamp: new Date().toISOString()
                    }, { status: 400 });
                }

                // Update the group
                const group = await locals.prisma.group.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        description: form.data.description || null,
                        permissions: form.data.permissions, // Store as string, not parsed object
                        accountId: form.data.accountId
                    }
                });

                // Log the group update
                logger.info(`Group updated: ${group.id} (${group.name})`);

                // Return success with the updated group
                return { form };
            } catch (err) {
                logger.error(`Error updating group: , ${err}`);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to update group: ' + (err instanceof Error ? err.message : 'Unknown error')
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    )
};
