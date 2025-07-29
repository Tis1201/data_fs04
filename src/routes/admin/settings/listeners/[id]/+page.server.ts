import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { listenerEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

export const load = restrict(
    async ({ params, locals }) => {
        try {
            logger.debug(`Loading listener with ID: ${params.id}`);
            
            // Load existing listener with related webhooks and WhatsApp accounts
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
                    updatedAt: true,
                    webhookEndpoints: {
                        select: {
                            webhookEndpoint: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    whatsappAccounts: {
                        select: {
                            whatsappAccount: {
                                select: {
                                    id: true,
                                    name: true,
                                    phoneNumber: true
                                }
                            }
                        }
                    }
                }
            });
            
            logger.debug(`Listener data: ${JSON.stringify(listener)}`);
            
            // Check if listener exists
            if (!listener) {
                logger.warn(`Listener with ID ${params.id} not found`);
                throw error(404, `Listener with ID ${params.id} not found`);
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
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            logger.error(`Error loading listener: ${errorMessage}`, e);
            
            // If it's already a SvelteKit error, just rethrow it
            if (e && typeof e === 'object' && 'status' in e) {
                throw e;
            }
            
            // Otherwise, create a new error
            throw error(500, `Failed to load listener: ${errorMessage}`);
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
                    const listenerEndpoint = await tx.listenerEndpoint.update({
                        where: { id },
                        data: updateData
                    });
                    
                    logger.info('Listener updated successfully:', { listenerId: id });

                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'ListenerEndpoint',
                        recordId: id,
                        oldData: existingListener,
                        newData: listenerEndpoint,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: locals.prisma,
                    })
                    
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
