import type { PageServerLoad } from './$types';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { generateId } from 'lucia';
import { superValidate } from 'sveltekit-superforms/server';
import { webhookSchema } from './new/webhook';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { getStatusBeforeToggled } from '$lib/utils';
import { deleteEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';

// Define table options for Webhook Endpoints
const table_options = {
    modelName: 'webhookEndPoint',
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
        
        return {
            webhooks: result.records,
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
            const form = await superValidate(request, zod(webhookSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const { name, postfix: rawPostfix, description, active, expiresAt } = form.data;
                const postfix = rawPostfix ?? '';
                if (!postfix) {
                    return fail(400, {
                        form,
                        error: 'Postfix is required'
                    });
                }
                
                // Check if webhook with the same postfix already exists
                const existingWebhook = await locals.prisma.webhookEndPoint.findFirst({
                    where: { postfix }
                });

                if (existingWebhook) {
                    return fail(400, {
                        form,
                        error: "Webhook with this postfix already exists"
                    });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, {
                        form,
                        error: "You must be logged in to create a webhook"
                    });
                }

                // Create webhook endpoint
                const webhookId = generateId(15);
                
                const webhook = await locals.prisma.webhookEndPoint.create({
                    data: {
                        id: webhookId,
                        name,
                        postfix,
                        description,
                        active: active ?? true,
                        expiresAt,
                        createdBy: auth.user.id
                    }
                });

                logger.info('Webhook endpoint created successfully:', { 
                    webhookId,
                    name,
                    postfix
                });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'WebhookEndpoint',
                    recordId: webhook.id,
                    oldData: null,
                    newData: webhook,
                    userId: auth.user.id,
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })

                return { 
                    form,
                    success: true
                };
            } catch (e) {
                logger.error('Error creating webhook endpoint', { error: e });
                return fail(500, {
                    form,
                    error: "Failed to create webhook endpoint"
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create webhook endpoints
    ),
    
    /*******************************************************************************************
     * Toggle Active Status
     ******************************************************************************************/
    toggleStatus: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            try {
                // Get the webhook ID and new status from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const status = data.get('status')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Webhook ID is required' });
                }
                
                if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
                    return fail(400, { error: 'Valid status is required' });
                }
                
                // Get the webhook to be updated
                const webhook = await locals.prisma.webhookEndPoint.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        name: true,
                        postfix: true,
                        status: true
                    }
                });

                if (!webhook) {
                    return fail(404, { error: 'Webhook endpoint not found' });
                }

                // Update the webhook status
                await locals.prisma.webhookEndPoint.update({
                    where: { id },
                    data: { 
                        status,
                        active: status === 'ACTIVE' // Keep active field in sync for backward compatibility
                    }
                });

                logger.info(`Webhook ${id} status changed to ${status}`, {
                    webhookId: id,
                    name: webhook.name,
                    status
                });

                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'WebhookEndpoint',
                    recordId: webhook.id,
                    oldData: getStatusBeforeToggled(status),
                    newData: { status },
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling webhook status`, { error: err });
                return fail(500, { error: 'Failed to update webhook status' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to toggle webhook status
    ),

    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    delete: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            try {
                // Get the webhook ID from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Webhook ID is required' });
                }
                
                // Get the webhook to be deleted
                const webhook = await locals.prisma.webhookEndPoint.findUnique({
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

                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'WebhookEndpoint',
                    recordId: id,
                    oldData: webhook,
                    newData: null,
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })
                
                // Return success response
                return {
                    success: true,
                    message: 'Webhook endpoint deleted successfully'
                };

            } catch (e) {
                logger.error('Error deleting webhook endpoint', { error: e });
                if ((e as any)?.code === 'P2025') {
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
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
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
                const updatedWebhook = await locals.prisma.webhookEndPoint.update({
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

                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'WebhookEndpoint',
                    recordId: id,
                    oldData: webhook,
                    newData: updatedWebhook,
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                })
                
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
    ),
    
    deleteWebhook: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            const formData = await request.formData();
            const id = formData.get('id') as string;
            
            if (!id) {
                return fail(400, { success: false, error: 'Webhook ID is required' });
            }
            
            try {
                // Check if webhook exists
                const webhook = await locals.prisma.webhookEndPoint.findUnique({
                    where: { id }
                });
                
                if (!webhook) {
                    return fail(404, { success: false, error: 'Webhook endpoint not found' });
                }
                
                // Delete the webhook
                await locals.prisma.webhookEndPoint.delete({
                    where: { id }
                });
                
                logger.info('Webhook endpoint deleted successfully', { 
                    webhookId: id,
                    name: webhook.name
                });
                
                const auth = await locals.auth.validate();

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'WebhookEndpoint',
                    recordId: id,
                    oldData: webhook,
                    newData: null,
                    userId: auth?.user?.id ?? '',
                    ipAddress: event.getClientAddress(),
                    prisma: locals.prisma,
                });
                
                return { 
                    success: true,
                    message: 'Webhook endpoint deleted successfully'
                };
            } catch (err) {
                logger.error('Error deleting webhook endpoint', { 
                    error: err 
                });
                return fail(500, { success: false, error: 'Failed to delete webhook endpoint' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete webhook endpoints
    )
};
