import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { webhookSchema } from '../new/webhook';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

export const load = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, locals } = event;
        const { id } = params;
        
        try {
            // Fetch the webhook by ID
            const webhook = await locals.prisma.webhookEndPoint.findUnique({
                where: { id }
            });
            
            // If webhook doesn't exist, throw a 404 error
            if (!webhook) {
                throw error(404, 'Webhook not found');
            }
            
            // Initialize the form with webhook data
            const formData = {
                name: webhook.name,
                description: webhook.description || '',
                active: webhook.active,
                status: webhook.status as 'ACTIVE' | 'INACTIVE',
                expiresAt: webhook.expiresAt,
                postfix: webhook.postfix
            };
            const form = await superValidate(formData, zod(webhookSchema));
            
            return {
                webhook,
                form
            };
        } catch (err) {
            logger.error(`Error loading webhook: ${err}`);
            throw error(500, 'Failed to load webhook');
        }
    },
    [SystemRole.ADMIN]
);

export const actions: Actions = {
    update: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id } = params;
            const form = await superValidate(request, zod(webhookSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Check if webhook exists
                const existingWebhook = await locals.prisma.webhookEndPoint.findUnique({
                    where: { id }
                });
                
                if (!existingWebhook) {
                    return message(form, {
                        type: 'error',
                        text: 'Webhook not found',
                        details: `No webhook found with ID: ${id}`,
                        code: 'WEBHOOK_NOT_FOUND',
                        timestamp: new Date().toISOString()
                    }, { status: 404 });
                }
                
                // Update the webhook
                const updatedWebhook = await locals.prisma.webhookEndPoint.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        description: form.data.description,
                        status: form.data.status,
                        active: form.data.status === 'ACTIVE',
                        expiresAt: form.data.expiresAt,
                        updatedAt: new Date()
                    }
                });
                
                logger.info(`Webhook updated: ${id} (${updatedWebhook.name}) - Status: ${updatedWebhook.status}`);
                
                // Audit logging
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'WebhookEndpoint',
                    recordId: updatedWebhook.id,
                    oldData: existingWebhook,
                    newData: updatedWebhook,
                    userId: (locals as any).user.id,
                    ipAddress: (locals as any).ipAddress,
                    prisma: locals.prisma
                });
                
                // Return success message
                return message(form, {
                    type: 'success',
                    text: 'Webhook updated successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (err) {
                logger.error(`Error updating webhook: ${err}`);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to update webhook',
                    details: err instanceof Error ? err.message : 'An unexpected error occurred',
                    code: 'UPDATE_FAILED',
                    timestamp: new Date().toISOString()
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    deleteWebhook: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, params, locals } = event;
            const { id } = params;
            
            if (!id) {
                return fail(400, { success: false, error: 'Webhook ID is required' });
            }
            
            try {
                // Check if webhook exists
                const webhook = await locals.prisma.webhookEndPoint.findUnique({
                    where: { id }
                });
                
                if (!webhook) {
                    logger.warn(`Webhook not found: ${id}`);
                    return fail(404, { success: false, error: 'Webhook endpoint not found' });
                }
                
                logger.info(`Found webhook: ${webhook.name} (${webhook.id})`);
                
                // Delete the webhook
                const deletedWebhook = await locals.prisma.webhookEndPoint.delete({
                    where: { id }
                });
                
                logger.info(`Webhook successfully deleted from database: ${deletedWebhook.id} (${deletedWebhook.name})`);
                
                // Audit logging with better error handling
                try {
                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'WebhookEndpoint',
                        recordId: id,
                        oldData: deletedWebhook,
                        newData: null,
                        userId: (locals as any).user?.id || 'unknown',
                        ipAddress: (locals as any).ipAddress || 'unknown',
                        prisma: locals.prisma
                    });
                    logger.info(`Audit log entry created for webhook deletion: ${id}`);
                } catch (auditError) {
                    // Don't fail the deletion if audit logging fails
                    logger.error('Failed to create audit log entry:', auditError as Record<string, any>);
                }
                
                logger.info(`Webhook deletion completed successfully: ${id}`);
                return { success: true };
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                const stackTrace = err instanceof Error ? err.stack : undefined;
                
                logger.error(`Error deleting webhook ${id}:`, { 
                    message: errorMsg, 
                    stack: stackTrace,
                    webhookId: id
                });
                
                // Provide more specific error messages based on the error type
                if (errorMsg.includes('Foreign key constraint')) {
                    return fail(400, { success: false, error: 'Cannot delete webhook - it is still referenced by other records.' });
                } else if (errorMsg.includes('Record to delete does not exist')) {
                    return fail(404, { success: false, error: 'Webhook not found or already deleted.' });
                } else {
                    return fail(500, { success: false, error: `Failed to delete webhook: ${errorMsg}` });
                }
            }
        },
        [SystemRole.ADMIN]
    )
};

