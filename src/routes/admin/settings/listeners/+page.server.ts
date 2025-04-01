import type { PageServerLoad } from './$types';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { generateId } from 'lucia';
import { superValidate } from 'sveltekit-superforms/server';
// import { listenerSchema } from './new/listener';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '../../users/schema';

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
    async ({ url, locals }) => {
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
        async ({ request, locals }) => {
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
                logger.error('Error creating listener endpoint:', e);
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
        async ({ request, locals }) => {
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
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling listener status:`, err);
                return fail(500, { error: 'Failed to update listener status' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to toggle listener status
    ),

    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    delete: restrict(
        async ({ request, locals }) => {
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

                if (!webhook) {
                    return fail(404, { error: 'Webhook endpoint not found' });
                }

                // Delete the webhook
                await locals.prisma.webhookEndPoint.delete({
                    where: { id }
                });

                logger.info('Webhook endpoint deleted successfully:', { 
                    webhookId: id,
                    name: webhook.name,
                    postfix: webhook.postfix
                });
                
                // Return success response
                return {
                    success: true,
                    message: 'Webhook endpoint deleted successfully'
                };

            } catch (e) {
                logger.error('Error deleting webhook endpoint:', e);
                if (e.code === 'P2025') {
                    return fail(404, {
                        error: 'Webhook endpoint not found'
                    });
                }
                return fail(500, {
                    error: 'Failed to delete webhook endpoint'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete webhook endpoints
    ),
    
    /*******************************************************************************************
     * Update
     ******************************************************************************************/
    update: restrict(
        async ({ request, locals }) => {
            try {
                const form = await superValidate(request, zod(webhookSchema));
                if (!form.valid) {
                    return fail(400, { form });
                }
                
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { form, error: 'Webhook ID is required' });
                }
                
                const { name, postfix, description, active, expiresAt } = form.data;
                
                // Check if the webhook exists
                const webhook = await locals.prisma.webhookEndPoint.findUnique({
                    where: { id }
                });
                
                if (!webhook) {
                    return fail(404, { form, error: 'Webhook endpoint not found' });
                }
                
                // Check if another webhook with the same postfix exists
                if (postfix !== webhook.postfix) {
                    const existingWebhook = await locals.prisma.webhookEndPoint.findFirst({
                        where: { 
                            postfix,
                            id: { not: id }
                        }
                    });
                    
                    if (existingWebhook) {
                        return fail(400, {
                            form,
                            error: "Another webhook with this postfix already exists"
                        });
                    }
                }
                
                // Update the webhook
                await locals.prisma.webhookEndPoint.update({
                    where: { id },
                    data: {
                        name,
                        postfix,
                        description,
                        active: active ?? webhook.active,
                        expiresAt
                    }
                });
                
                logger.info('Webhook endpoint updated successfully', { 
                    webhookId: id,
                    name,
                    postfix
                });
                
                return { 
                    form,
                    success: true,
                    message: 'Webhook endpoint updated successfully'
                };
            } catch (err) {
                logger.error('Error updating webhook endpoint', { 
                    error: err 
                });
                return fail(500, { success: false, message: 'Failed to update webhook endpoint' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to update webhook endpoints
    )
};