import type { PageServerLoad } from './$types';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { generateId } from 'lucia';
import { superValidate } from 'sveltekit-superforms/server';
// import { listenerSchema } from './new/listener';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { listenerSchema } from './new/schema';
import { getStatusBeforeToggled } from '$lib/utils';

// Define table options for Listener Endpoints
const table_options = {
    modelName: 'listenerEndpoint',
    searchableFields: ['name', 'postfix', 'description'],
    allowedFilters: ['statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'statuses': { 
            field: 'status', 
            operator: 'in'
        }
    }
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        // Enhance the listeners with their webhook endpoints and WhatsApp accounts
        const enhancedListeners = await Promise.all(result.records.map(async (listener) => {
            // Get associated webhook endpoints
            const webhookConnections = await locals.prisma.listenerWebhookEndpoint.findMany({
                where: { listenerId: listener.id },
                include: { webhookEndpoint: true }
            });
            
            // Get associated WhatsApp accounts
            const whatsappConnections = await locals.prisma.listenerWhatsAppAccount.findMany({
                where: { listenerId: listener.id },
                include: { whatsappAccount: true }
            });
            
            return {
                ...listener,
                webhookEndpoints: webhookConnections.map(conn => conn.webhookEndpoint),
                whatsappAccounts: whatsappConnections.map(conn => conn.whatsappAccount)
            };
        }));
        
        return {
            listeners: enhancedListeners,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Create
     ******************************************************************************************/
    create: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            const form = await superValidate(request, zod(listenerSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const { name, postfix, description, listenToAll, expiresAt } = form.data;
                const webhookEndpointIds = form.data.webhookEndpointIds || [];
                const whatsappAccountIds = form.data.whatsappAccountIds || [];
                
                // Check if listener with the same postfix already exists
                const existingListener = await locals.prisma.listenerEndpoint.findFirst({
                    where: { postfix }
                });

                if (existingListener) {
                    return fail(400, {
                        form,
                        error: "Listener with this postfix already exists"
                    });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, {
                        form,
                        error: "You must be logged in to create a listener"
                    });
                }

                // Create listener endpoint
                const listenerId = generateId(15);
                
                // Create the listener with the data from the form
                const listener = await locals.prisma.listenerEndpoint.create({
                    data: {
                        id: listenerId,
                        name,
                        postfix,
                        description,
                        listenToAll: listenToAll ?? true,
                        expiresAt,
                        userId: auth.user.id
                    }
                });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'ListenerEndpoint',
                    recordId: listener.id,
                    oldData: null,
                    newData: listener,
                    userId: auth.user.id,
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })
                
                // Create webhook endpoint connections if not listening to all
                if (!listenToAll && webhookEndpointIds.length > 0) {
                    for (const webhookEndpointId of webhookEndpointIds) {
                        await locals.prisma.listenerWebhookEndpoint.create({
                            data: {
                                listenerId: listener.id,
                                webhookEndpointId
                            }
                        });
                    }
                }
                
                // Create WhatsApp account connections if not listening to all
                if (!listenToAll && whatsappAccountIds.length > 0) {
                    for (const whatsappAccountId of whatsappAccountIds) {
                        await locals.prisma.listenerWhatsAppAccount.create({
                            data: {
                                listenerId: listener.id,
                                whatsappAccountId
                            }
                        });
                    }
                }

                logger.info('Listener endpoint created successfully:', { 
                    listenerId,
                    name,
                    postfix
                });

                return { 
                    form,
                    success: true
                };
            } catch (e) {
                logger.error('Error creating listener endpoint', { error: e });
                return fail(500, {
                    form,
                    error: "Failed to create listener endpoint"
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create listener endpoints
    ),
    
    /*******************************************************************************************
     * Toggle Active Status
     ******************************************************************************************/
    toggleStatus: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            try {
                // Get the listener ID and new status from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const status = data.get('status')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Listener ID is required' });
                }
                
                if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
                    return fail(400, { error: 'Valid status is required' });
                }
                
                // Get the listener to be updated
                const listener = await locals.prisma.listenerEndpoint.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        postfix: true,
                        status: true
                    }
                });

                if (!listener) {
                    return fail(404, { error: 'Listener endpoint not found' });
                }

                // Update the listener status
                await locals.prisma.listenerEndpoint.update({
                    where: { id },
                    data: { 
                        status
                    }
                });

                logger.info(`Listener ${id} status changed to ${status}`, {
                    listenerId: id,
                    name: listener.name,
                    status
                });

                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'ListenerEndpoint',
                    recordId: id,
                    oldData: getStatusBeforeToggled(status),
                    newData: { status },
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling listener status`, { error: err });
                return fail(500, { error: 'Failed to update listener status' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to toggle listener status
    ),

    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    delete: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            try {
                // Get the listener ID from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Listener ID is required' });
                }
                
                // Get the listener to be deleted
                const listener = await locals.prisma.listenerEndpoint.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        postfix: true
                    }
                });

                if (!listener) {
                    return fail(404, { error: 'Listener endpoint not found' });
                }

                // Delete the listener
                await locals.prisma.listenerEndpoint.delete({
                    where: { id }
                });

                logger.info('Listener endpoint deleted successfully:', { 
                    listenerId: id,
                    name: listener.name,
                    postfix: listener.postfix
                });

                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'ListenerEndpoint',
                    recordId: id,
                    oldData: listener,
                    newData: null,
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })
                
                // Return success response
                return {
                    success: true,
                    message: 'Listener endpoint deleted successfully'
                };

            } catch (e) {
                logger.error('Error deleting listener endpoint', { error: e });
                if ((e as any)?.code === 'P2025') {
                    return fail(404, {
                        error: 'Listener endpoint not found'
                    });
                }
                return fail(500, {
                    error: 'Failed to delete listener endpoint'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete webhook endpoints
    ),
    
    /*******************************************************************************************
     * Update
     ******************************************************************************************/
    update: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            try {
                const form = await superValidate(request, zod(listenerSchema));
                if (!form.valid) {
                    return fail(400, { form });
                }
                
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { form, error: 'Listener ID is required' });
                }
                
                const { name, postfix, description, active, expiresAt } = form.data;
                
                // Check if the listener exists
                const listener = await locals.prisma.listenerEndpoint.findUnique({
                    where: { id }
                });
                
                if (!listener) {
                    return fail(404, { form, error: 'Listener endpoint not found' });
                }
                
                // Check if another listener with the same postfix exists
                if (postfix !== listener.postfix) {
                    const existinglistener = await locals.prisma.listenerEndpoint.findFirst({
                        where: { 
                            postfix,
                            id: { not: id }
                        }
                    });
                    
                    if (existinglistener) {
                        return fail(400, {
                            form,
                            error: "Another listener with this postfix already exists"
                        });
                    }
                }
                
                // Update the listener
                const updatedListener = await locals.prisma.listenerEndpoint.update({
                    where: { id },
                    data: {
                        name,
                        postfix,
                        description,
                        active: active ?? listener.active,
                        expiresAt
                    }
                });
                
                logger.info('listener endpoint updated successfully', { 
                    listenerId: id,
                    name,
                    postfix
                });

                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'ListenerEndpoint',
                    recordId: id,
                    oldData: listener,
                    newData: updatedListener,
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })
                
                return { 
                    form,
                    success: true,
                    message: 'listener endpoint updated successfully'
                };
            } catch (err) {
                logger.error('Error updating listener endpoint', { 
                    error: err 
                });
                return fail(500, { success: false, message: 'Failed to update listener endpoint' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to update listener endpoints
    )
};