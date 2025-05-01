import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { listenerEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';

export const load = restrict(
    async ({ params, locals }) => {
        try {
            logger.debug(`Loading listener with ID: ${params.id}`);
            
            // Load existing listener
            const listener = await locals.prisma.listenerEndpoint.findUnique({
                where: { id: params.id },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    postfix: true,
                    status: true,
                    expiresAt: true,
                    lastSeenAt: true,
                    listenToAll: true,
                    userId: true,
                    createdAt: true,
                    updatedAt: true
                }
            });
            
            logger.debug(`Listener data: ${JSON.stringify(listener)}`);
            

            if (!listener) {
                throw error(404, "Listener not found");
            }

            const form = await superValidate(
                {
                    id: listener.id,
                    name: listener.name,
                    description: listener.description,
                    status: listener.status,
                    listenToAll: listener.listenToAll,
                    postfix: listener.postfix,
                    expiresAt: listener.expiresAt
                }, 
                zod(listenerEditSchema)
            );

            return {
                form,
                listener
            };
        } catch (e) {
            logger.error('Error loading listener:', e);
            throw error(500, 'Failed to load listener');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update listener data
     */
    save: restrict(
        async ({ request, params, locals }) => {
            const id = params.id;
            const form = await superValidate(request, zod(listenerEditSchema));
            logger.debug('Update listener form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Start a transaction to ensure data consistency
                return await locals.prisma.$transaction(async (tx) => {
                    // First check if listener exists
                    const existingListener = await tx.listenerEndpoint.findUnique({
                        where: { id }
                    });
                    
                    if (!existingListener) {
                        return fail(404, {
                            form,
                            error: 'Listener not found'
                        });
                    }
                    
                    // Prepare update data
                    const updateData = {
                        name: form.data.name,
                        description: form.data.description,
                        status: form.data.status,
                        listenToAll: form.data.listenToAll,
                        expiresAt: form.data.expiresAt
                    };
                    
                    // Update listener
                    await tx.listenerEndpoint.update({
                        where: { id },
                        data: updateData
                    });
                    
                    logger.info('Listener updated successfully:', { listenerId: id });
                    
                    return {
                        form,
                        success: true
                    };
                });
            } catch (e) {
                logger.error('Error updating listener:', e);
                return fail(500, {
                    form,
                    error: 'Failed to update listener'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to update listeners
    )
};
