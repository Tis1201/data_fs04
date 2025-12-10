import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { createWhatsAppAccountSchema } from '$lib/schemas/whatsapp-account';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { logger } from '$lib/server/logger';
import { validateAndGetUserId } from '$lib/server/security/auth-utils';

export const load = restrict(
    async ({ locals }: AuthenticatedEvent) => {
        // Initialize the form with the schema and defaults
        const form = await superValidate(zod(createWhatsAppAccountSchema), {
            id: 'whatsapp-account-form',
            defaults: {
                description: '',
                client_id: ''
            }
        });
        
        try {
            // Create a new WhatsApp client directly in the load function
            // This will trigger QR code generation which will be sent via WebSocket
            // Let Baileys generate the client ID
            const user_id = await validateAndGetUserId(locals);

            // Pass the user ID to createClient so it knows who created this client
            // Add a small delay to ensure the page and WebSocket connection are ready
            // await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
            // const { clientId, qrCodePromise } = await whatsAppAccountManager.createNewClient(user_id);

            // logger.debug(`Created WhatsApp client with userId: ${user_id} during page load`);
            
            // console.log(`Created WhatsApp client with ID ${clientId} during page load`);
                  
            return { 
                form, 
                clientId: null
                // clientId
            };
        } catch (error) {
            console.error('Error creating WhatsApp client during page load:', error);
            // We don't throw here to allow the page to load even if client creation fails
            // The user can request a new QR code from the UI
            
            return { 
                form,
                clientId: null
            };
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Main action for creating a WhatsApp account
    createAccount: restrict(
    async ({ request, locals }: AuthenticatedEvent) => {
        const auth = await locals.auth.validate();
        if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
            throw error(403, 'Not authorized to create WhatsApp accounts');
        }
        
        // Validate form submission
        const form = await superValidate(request, zod(createWhatsAppAccountSchema));
        
        if (!form.valid) {
            return fail(400, { form });
        }
        
        try {
            // Get enhanced prisma client with user context
            const prisma = locals.prisma;
            
            // Log user info for debugging
            console.log('User info:', auth.user);
            console.log('Form data received:', form.data);
            
            // Create the WhatsApp account with the client_id from the form
            // The client_id should have been set in the frontend when the WebSocket connection was authenticated
            if (!form.data.client_id) {
                // SuperForms expects the form to be at the top level
                return fail(400, message(form, 'Client ID is required. Please authenticate with WhatsApp first.', { status: 400 }));
            }
            
            // Log the client ID from the form for debugging
            logger.info(`Received client_id from form: ${form.data.client_id}`);
            
            // Validate client ID format (should be UUID)
            const isValidClientId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.data.client_id);
            
            if (!isValidClientId) {
                logger.warn(`Invalid client ID format: ${form.data.client_id}`);
                return fail(400, message(form, 'Invalid client ID format. Please reconnect your WhatsApp account.', { status: 400 }));
            }
            
            // Get client directly by ID
            const client = whatsAppAccountManager.getClient(form.data.client_id);
            
            if (!client) {
                logger.warn(`Client with ID ${form.data.client_id} not found when creating account`);
                return fail(400, message(form, 'WhatsApp client not found. Please reconnect and try again.', { status: 400 }));
            }
            
            const clientInfo = (client ? client.getInfo() : null) as { phoneNumber?: string | null; pushName?: string | null } | null;
            
            if (!clientInfo) {
                logger.warn(`Client info not available for client ${form.data.client_id}`);
            }
            
            // Log all the data we have for debugging
            logger.info('Account creation data:', {
                fromForm: {
                    clientId: form.data.client_id,
                    phoneNumber: form.data.phoneNumber,
                    name: form.data.name,
                    description: form.data.description
                },
                fromClient: clientInfo ? {
                    phoneNumber: clientInfo.phoneNumber,
                    pushName: clientInfo.pushName
                } : 'No client info available',
                finalValues: {
                    clientId: form.data.client_id,
                    phoneNumber: form.data.phoneNumber || clientInfo?.phoneNumber || 'Unknown',
                    name: form.data.name || clientInfo?.pushName || 'Unknown'
                }
            });
            
            // Create the WhatsApp account in the database
            const account = await prisma.whatsAppAccount.create({
                data: {
                    description: form.data.description,
                    client_id: form.data.client_id, // Match the field name in the schema
                    createdBy: auth.user.id, // Field is named createdBy in the schema, not userId
                    phoneNumber: form.data.phoneNumber || clientInfo?.phoneNumber || 'Unknown',
                    name: form.data.name || clientInfo?.pushName
                }
            });
            
            // Update the client's account ID
            if (client) {
                if (typeof (client as any).setAccountId === 'function') {
                    await (client as any).setAccountId(account.id);
                }
            }

            // Create a success message with the form data
            const successForm = message(form, 'WhatsApp account created successfully!');
            
            // Add the account data to the form data object directly
            // This ensures SuperForms gets the form data at the top level
            const formWithAccount = {
                ...successForm,
                account
            };
            
            // Log the response for debugging
            logger.info('Sending successful response with account data:', {
                accountId: account.id,
                description: account.description,
                responseStructure: Object.keys(formWithAccount)
            });
            
            // Return the form object with success and account data
            // SuperForms expects the form to be at the top level
            return formWithAccount;
        } catch (err) {
            // Log the full error for debugging
            logger.error('Error creating WhatsApp account:', err as Record<string, unknown>);
            
            // Provide a more specific error message if possible
            const errorMessage = err instanceof Error 
                ? `Failed to create WhatsApp account: ${err.message}` 
                : 'Failed to create WhatsApp account. Please try again.';
            
            // SuperForms expects the form to be at the top level, even in error cases
            return fail(500, message(form, errorMessage, { status: 500 }));
        }
    },
    [SystemRole.ADMIN]
    ),
    
    // Action to request a new QR code
    requestQRCode: restrict(async (_event: AuthenticatedEvent) => {
        try {
            // Create a new WhatsApp client and let Baileys generate the client ID
            const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient();
            
            console.log(`Created new WhatsApp client with ID ${clientId} via requestQRCode action`);
            return { success: true, clientId };
        } catch (error) {
            console.error('Error requesting QR code:', error);
            return fail(500, { error: 'Failed to request QR code' });
        }
    }, [SystemRole.ADMIN])
} satisfies Actions;
