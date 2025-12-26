import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { webhookSchema } from './webhook';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { generateId } from 'lucia';
import { randomUUID } from 'crypto';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { upsertEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';



export const load = restrict(
    async ({ locals }: AuthenticatedLoadEvent) => {
        // Generate a sample postfix for preview
        const timestamp = Date.now().toString(36);
        const uuid = randomUUID().replace(/-/g, '');
        const samplePostfix = `${timestamp}-${uuid}`;
        
        // Initialize the form with the schema and defaults
        const form = await superValidate(zod(webhookSchema), {
            defaults: {
                name: '',
                postfix: '',
                description: '',
                active: true,
                status: 'ACTIVE', // Default to ACTIVE status
                expiresAt: null
            }
        });
        
        return { 
            form,
            samplePostfix // Pass the sample postfix to the client
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions = {
    
    /**
     * Create new webhook endpoint
     */
    create: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            logger.info('Create webhook action triggered');
            
            const form = await superValidate(request, zod(webhookSchema));
            logger.debug('Create webhook form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Extract all form data fields
                const { name, description, active, status, expiresAt } = form.data;
                
                // Generate a strong UUID for the postfix to ensure it's not easily guessable
                // Use a combination of random UUID and timestamp to ensure uniqueness
                const timestamp = Date.now().toString(36);
                // Use the full UUID for better security instead of truncating
                const uuid = randomUUID().replace(/-/g, '');
                const postfix = `${timestamp}-${uuid}`;
                
                // Check if webhook with the same postfix already exists (unlikely but possible)
                const existingWebhook = await locals.prisma.webhookEndPoint.findFirst({
                    where: { postfix }
                });

                if (existingWebhook) {
                    // In the extremely unlikely case of a collision, try again with a different postfix
                    return fail(400, {
                        form,
                        message: {
                            type: 'error' as const,
                            text: 'System error',
                            details: 'Failed to generate a unique webhook identifier. Please try again.'
                        }
                    });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, {
                        form,
                        message: {
                            type: 'error' as const,
                            text: 'Authentication required',
                            details: 'You must be logged in to create a webhook.'
                        }
                    });
                }

                // Create webhook endpoint
                const webhookId = generateId(15);
                
                // Log form data for debugging
                logger.debug('Webhook form data:', { name, status, active });
                
                // Create webhook with the status from the form
                // If status is not provided, derive it from active field for backward compatibility
                const webhookStatus = status || (active === true ? "ACTIVE" : "INACTIVE");
                
                const webhook = await locals.prisma.webhookEndPoint.create({
                    data: {
                        id: webhookId,
                        name,
                        postfix,
                        description,
                        active: webhookStatus === "ACTIVE", // Set active based on status
                        expiresAt,
                        createdBy: auth.user.id,
                        status: webhookStatus
                    }
                });

                logger.info('Webhook endpoint created successfully:', { 
                    webhookId,
                    name,
                    postfix
                });

                // Create cronjob for webhook expiration (only if expiresAt is set)
                if (webhook.expiresAt) {
                    await upsertEntityExpirationCronjob(locals.prisma, {
                        entityType: 'webhookEndpoint',
                        entityId: webhook.id,
                        expiresAt: webhook.expiresAt,
                        action: 'deactivate',
                        userId: auth.user.id,
                        accountId: null
                    });
                }

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

                // Return success with the form data
                return { 
                    form,
                    success: true,
                    message: {
                        type: 'success' as const,
                        text: 'Webhook created successfully',
                        details: `Webhook '${name}' has been created.`
                    }
                };
            } catch (error) {
                logger.error('Error creating webhook endpoint', { error });
                
                // Determine the type of error and return appropriate response
                let errorMessage = {
                    type: 'error' as const,
                    text: 'Unable to create webhook',
                    details: 'An unexpected error occurred while processing your request.'
                };
                
                // Handle specific error types
                const errAny = error as any;

                if (errAny?.code === 'P2002') {
                    // Unique constraint violation
                    errorMessage.text = 'Webhook already exists';
                    errorMessage.details = `A webhook with this ${errAny?.meta?.target?.[0] || 'identifier'} already exists.`;
                } else if (errAny?.code === 'P2003') {
                    // Foreign key constraint violation
                    errorMessage.text = 'Invalid reference';
                    errorMessage.details = 'One of the references in your request is invalid.';
                } else if (errAny?.code === 'FORBIDDEN') {
                    // Zenstack permission error
                    errorMessage.text = 'Permission denied';
                    errorMessage.details = 'You do not have permission to perform this action.';
                }
                
                // Return a structured error response with the form data
                return fail(400, {
                    form,
                    message: {
                        ...errorMessage,
                        code: errAny?.code || 'UNKNOWN_ERROR',
                        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create webhook endpoints
    )
};
