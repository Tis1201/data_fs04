import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { listenerSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { generateId } from 'lucia';
import { randomUUID } from 'crypto';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';



export const load = restrict(
    async ({ locals }: AuthenticatedLoadEvent) => {
        // Generate a sample postfix for preview
        const timestamp = Date.now().toString(36);
        const uuid = randomUUID().replace(/-/g, '');
        const samplePostfix = `${timestamp}-${uuid}`;
        
        // Get webhook endpoints and WhatsApp accounts for the form
        const webhookEndpoints = await locals.prisma.webhookEndPoint.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, postfix: true }
        });
        
        // Get all WhatsApp accounts
        const whatsappAccounts = await locals.prisma.whatsAppAccount.findMany({
            select: { 
                id: true, 
                name: true, 
                phoneNumber: true,
                client_status: true // Include connection status for display
            }
        });
        
        // Initialize the form with the schema and defaults
        const form = await superValidate(zod(listenerSchema), {
            defaults: {
                name: '',
                postfix: '',
                description: '',
                status: 'ACTIVE', // Default to ACTIVE status
                listenToAll: true, // Default to listen to all events
                webhookEndpointIds: [],
                whatsappAccountIds: [],
                expiresAt: null
            }
        });
        
        return { 
            form,
            samplePostfix, // Pass the sample postfix to the client
            webhookEndpoints,
            whatsappAccounts
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions = {
    
    /**
     * Create new event listener endpoint
     */
    create: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals } = event;
            logger.info('Create event listener action triggered');
            
            // Get the raw form data from the request
            const formData = await request.formData();
            const rawFormEntries = Array.from(formData.entries());
            logger.debug('Raw form entries:', rawFormEntries);
            
            // Extract array values from the raw form data
            const webhookEndpointIds = rawFormEntries
                .filter(entry => String(entry[0]) === 'webhookEndpointIds' && entry[1])
                .map(entry => String(entry[1]));
                
            const whatsappAccountIds = rawFormEntries
                .filter(entry => String(entry[0]) === 'whatsappAccountIds' && entry[1])
                .map(entry => String(entry[1]));
                
            logger.debug('Extracted webhook IDs:', webhookEndpointIds);
            logger.debug('Extracted WhatsApp IDs:', whatsappAccountIds);
            
            // Get the listenToAll value
            const listenToAllValue = formData.get('listenToAll');
            const listenToAll = listenToAllValue === 'true' || listenToAllValue === 'on';
            logger.debug('Listen to all value:', { raw: listenToAllValue, processed: listenToAll });
            
            // Create a new FormData object with our extracted array values
            const enhancedFormData = new FormData();
            
            // Copy all original form entries
            for (const [key, value] of formData.entries()) {
                // Skip the arrays, we'll add them manually
                if (key !== 'webhookEndpointIds' && key !== 'whatsappAccountIds') {
                    enhancedFormData.append(key, value);
                }
            }
            
            // Make sure listenToAll is properly set
            enhancedFormData.set('listenToAll', String(listenToAll));
            
            // Add the webhook endpoint IDs
            for (const id of webhookEndpointIds) {
                enhancedFormData.append('webhookEndpointIds', id);
            }
            
            // Add the WhatsApp account IDs
            for (const id of whatsappAccountIds) {
                enhancedFormData.append('whatsappAccountIds', id);
            }
            
            // Validate the form with our enhanced form data
            const form = await superValidate(enhancedFormData, zod(listenerSchema));
            logger.debug('Enhanced form data:', form);
            
            if (!form.valid) {
                logger.error('Form validation failed:', form.errors);
                return fail(400, { 
                    form,
                    message: {
                        type: 'error',
                        text: 'Validation error',
                        details: 'Please check the form for errors and try again.'
                    }
                });
            }

            try {
                // Extract all form data fields from the validated form
                const { name, description, status, expiresAt } = form.data;
                
                // We'll still use our manually extracted arrays to ensure they're correct
                
                // Use the arrays we extracted from the raw form data
                // This ensures we get the correct values even if superValidate doesn't process them correctly
                
                // Log the data we're going to use
                logger.debug('Using form data:', { 
                    name, 
                    description, 
                    status, 
                    expiresAt,
                    listenToAll,
                    webhookEndpointIds,
                    whatsappAccountIds
                });
                
                // Generate a strong UUID for the postfix to ensure it's not easily guessable
                // Use a combination of random UUID and timestamp to ensure uniqueness
                const timestamp = Date.now().toString(36);
                // Use the full UUID for better security instead of truncating
                const uuid = randomUUID().replace(/-/g, '');
                const postfix = `${timestamp}-${uuid}`;
                
                // Check if listener with the same postfix already exists (unlikely but possible)
                const existingListener = await locals.prisma.listenerEndpoint.findFirst({
                    where: { postfix }
                });

                if (existingListener) {
                    // In the extremely unlikely case of a collision, try again with a different postfix
                    return fail(400, {
                        form,
                        message: {
                            type: 'error' as const,
                            text: 'System error',
                            details: 'Failed to generate a unique listener identifier. Please try again.'
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
                            details: 'You must be logged in to create an event listener.'
                        }
                    });
                }

                // Create listener endpoint
                const listenerId = generateId(15);
                
                // Log form data for debugging
                logger.debug('Event listener form data:', { name, status, listenToAll, webhookEndpointIds, whatsappAccountIds });
                
                // Create the listener with the data from the form
                const listener = await locals.prisma.listenerEndpoint.create({
                    data: {
                        id: listenerId,
                        name,
                        postfix,
                        description,
                        status,
                        expiresAt,
                        listenToAll: listenToAll ?? true,
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
                // Check if we have webhook endpoints to connect
                const hasWebhookIds = webhookEndpointIds.length > 0;
                logger.debug('Creating webhook connections:', { 
                    listenToAll, 
                    webhookEndpointIds, 
                    hasWebhookIds 
                });
                
                if (!listenToAll && hasWebhookIds) {
                    for (const webhookEndpointId of webhookEndpointIds) {
                        logger.debug('Creating webhook connection:', { listenerId: listener.id, webhookEndpointId });
                        const connection = await locals.prisma.listenerWebhookEndpoint.create({
                            data: {
                                listenerId: listener.id,
                                webhookEndpointId
                            }
                        });
                        logger.debug('Created webhook connection:', { connection });
                    }
                    
                    // Verify connections were created
                    const connections = await locals.prisma.listenerWebhookEndpoint.findMany({
                        where: { listenerId: listener.id },
                        include: { webhookEndpoint: true }
                    });
                    logger.debug('Verified webhook connections:', { connections });
                }
                
                // Create WhatsApp account connections if not listening to all
                // Check if we have WhatsApp accounts to connect
                const hasWhatsAppIds = whatsappAccountIds.length > 0;
                logger.debug('Creating WhatsApp connections:', { 
                    listenToAll, 
                    whatsappAccountIds, 
                    hasWhatsAppIds 
                });
                
                if (!listenToAll && hasWhatsAppIds) {
                    for (const whatsappAccountId of whatsappAccountIds) {
                        logger.debug('Creating WhatsApp connection:', { listenerId: listener.id, whatsappAccountId });
                        const connection = await locals.prisma.listenerWhatsAppAccount.create({
                            data: {
                                listenerId: listener.id,
                                whatsappAccountId
                            }
                        });
                        logger.debug('Created WhatsApp connection:', { connection });
                    }
                    
                    // Verify connections were created
                    const connections = await locals.prisma.listenerWhatsAppAccount.findMany({
                        where: { listenerId: listener.id },
                        include: { whatsappAccount: true }
                    });
                    logger.debug('Verified WhatsApp connections:', { connections });
                }

                logger.info('Event listener created successfully:', { 
                    listenerId,
                    name,
                    postfix
                });

                // Return success with the form data
                return { 
                    form,
                    success: true,
                    message: {
                        type: 'success' as const,
                        text: 'Event listener created successfully',
                        details: `Event listener '${name}' has been created.`
                    }
                };
            } catch (error) {
                logger.error('Error creating event listener', { error });
                
                // Determine the type of error and return appropriate response
                let errorMessage = {
                    type: 'error' as const,
                    text: 'Unable to create event listener',
                    details: 'An unexpected error occurred while processing your request.'
                };
                
                // Handle specific error types
                const errAny = error as any;

                if (errAny?.code === 'P2002') {
                    // Unique constraint violation
                    errorMessage.text = 'Event listener already exists';
                    errorMessage.details = `An event listener with this ${errAny?.meta?.target?.[0] || 'identifier'} already exists.`;
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
        [SystemRole.ADMIN] // Only allow admin role to create event listener endpoints
    )
};