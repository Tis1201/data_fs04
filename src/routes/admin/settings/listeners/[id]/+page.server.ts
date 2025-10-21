import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { listenerEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

export const load = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, locals } = event;
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

            // Get all available webhook endpoints
            const webhookEndpoints = await locals.prisma.webhookEndPoint.findMany({
                where: { status: 'ACTIVE' },
                select: {
                    id: true,
                    name: true,
                    postfix: true
                },
                orderBy: { name: 'asc' }
            });
            
            // Get all available WhatsApp accounts
            const whatsappAccounts = await locals.prisma.whatsAppAccount.findMany({
                where: { status: 'ACTIVE' },
                select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    client_status: true
                },
                orderBy: { name: 'asc' }
            });
            
            // Extract current webhook and WhatsApp IDs
            const currentWebhookIds = listener.webhookEndpoints?.map(w => w.webhookEndpoint.id) || [];
            const currentWhatsappIds = listener.whatsappAccounts?.map(w => w.whatsappAccount.id) || [];

            const form = await superValidate(
                {
                    id: listener.id,
                    name: listener.name,
                    description: listener.description,
                    status: listener.status as 'ACTIVE' | 'INACTIVE',
                    listenToAll: listener.listenToAll,
                    postfix: listener.postfix,
                    expiresAt: listener.expiresAt,
                    webhookEndpointIds: currentWebhookIds,
                    whatsappAccountIds: currentWhatsappIds
                }, 
                zod(listenerEditSchema)
            );

            return {
                form,
                listener,
                webhookEndpoints,
                whatsappAccounts
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            logger.error(`Error loading listener: ${errorMessage}`, e as Record<string, any>);
            
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
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const id = params.id;
            const form = await superValidate(request, zod(listenerEditSchema));
            logger.debug('Update listener form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // First check if listener exists
                const existingListener = await locals.prisma.listenerEndpoint.findUnique({
                    where: { id },
                    include: {
                        webhookEndpoints: true,
                        whatsappAccounts: true
                    }
                });
                
                if (!existingListener) {
                    return message(form, {
                        type: 'error',
                        text: 'Listener not found',
                        details: `No listener found with ID: ${id}`,
                        code: 'LISTENER_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }
                
                // Use transaction to update listener and connections
                await locals.prisma.$transaction(async (tx) => {
                    // Update listener basic info
                    await tx.listenerEndpoint.update({
                        where: { id },
                        data: {
                            name: form.data.name,
                            description: form.data.description,
                            status: form.data.status,
                            listenToAll: form.data.listenToAll,
                            expiresAt: form.data.expiresAt
                        }
                    });
                    
                    // Update webhook endpoint connections if not listening to all
                    if (!form.data.listenToAll) {
                        // Delete existing webhook connections
                        await tx.listenerWebhookEndpoint.deleteMany({
                            where: { listenerId: id }
                        });
                        
                        // Create new webhook connections
                        if (form.data.webhookEndpointIds && form.data.webhookEndpointIds.length > 0 && id) {
                            await tx.listenerWebhookEndpoint.createMany({
                                data: form.data.webhookEndpointIds.map(webhookId => ({
                                    listenerId: id,
                                    webhookEndpointId: webhookId
                                }))
                            });
                        }
                        
                        // Delete existing WhatsApp connections
                        await tx.listenerWhatsAppAccount.deleteMany({
                            where: { listenerId: id }
                        });
                        
                        // Create new WhatsApp connections
                        if (form.data.whatsappAccountIds && form.data.whatsappAccountIds.length > 0 && id) {
                            await tx.listenerWhatsAppAccount.createMany({
                                data: form.data.whatsappAccountIds.map(whatsappId => ({
                                    listenerId: id,
                                    whatsappAccountId: whatsappId
                                }))
                            });
                        }
                    } else {
                        // If listening to all, remove any specific connections
                        await tx.listenerWebhookEndpoint.deleteMany({
                            where: { listenerId: id }
                        });
                        await tx.listenerWhatsAppAccount.deleteMany({
                            where: { listenerId: id }
                        });
                    }
                });
                
                logger.info('Listener updated successfully:', { listenerId: id });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'ListenerEndpoint',
                    recordId: id || '',
                    oldData: existingListener,
                    newData: { ...form.data },
                    userId: (locals as any).user.id,
                    ipAddress: (locals as any).ipAddress,
                    prisma: locals.prisma,
                })
                
                // Return success message
                return message(form, {
                    type: 'success',
                    text: 'Listener updated successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (e) {
                logger.error('Error updating listener:', e as Record<string, any>);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to update listener',
                    details: e instanceof Error ? e.message : 'An unexpected error occurred',
                    code: 'UPDATE_FAILED',
                    timestamp: new Date().toISOString()
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to update listeners
    ),
    
    deleteListener: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id } = params;
            
            if (!id) {
                return fail(400, { success: false, error: 'Listener ID is required' });
            }
            
            try {
                // Check if listener exists
                const listener = await locals.prisma.listenerEndpoint.findUnique({
                    where: { id }
                });
                
                if (!listener) {
                    logger.warn(`Listener not found: ${id}`);
                    return fail(404, { success: false, error: 'Listener endpoint not found' });
                }
                
                logger.info(`Found listener: ${listener.name} (${listener.id})`);
                
                // Delete the listener (cascade will handle related records)
                const deletedListener = await locals.prisma.listenerEndpoint.delete({
                    where: { id }
                });
                
                logger.info(`Listener successfully deleted from database: ${deletedListener.id} (${deletedListener.name})`);
                
                // Audit logging with better error handling
                try {
                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'ListenerEndpoint',
                        recordId: id,
                        oldData: deletedListener,
                        newData: null,
                        userId: (locals as any).user?.id || 'unknown',
                        ipAddress: (locals as any).ipAddress || 'unknown',
                        prisma: locals.prisma
                    });
                    logger.info(`Audit log entry created for listener deletion: ${id}`);
                } catch (auditError) {
                    // Don't fail the deletion if audit logging fails
                    logger.error('Failed to create audit log entry:', auditError as Record<string, any>);
                }
                
                logger.info(`Listener deletion completed successfully: ${id}`);
                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                const stackTrace = err instanceof Error ? err.stack : undefined;
                
                logger.error(`Error deleting listener ${id}:`, { 
                    message: errorMsg, 
                    stack: stackTrace,
                    listenerId: id
                });
                
                // Provide more specific error messages based on the error type
                if (errorMsg.includes('Foreign key constraint')) {
                    return fail(400, { success: false, error: 'Cannot delete listener - it is still referenced by other records.' });
                } else if (errorMsg.includes('Record to delete does not exist')) {
                    return fail(404, { success: false, error: 'Listener not found or already deleted.' });
                } else {
                    return fail(500, { success: false, error: `Failed to delete listener: ${errorMsg}` });
                }
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete listeners
    )
};
