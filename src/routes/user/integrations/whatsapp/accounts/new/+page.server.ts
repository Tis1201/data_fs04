import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { createWhatsAppAccountSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { v4 as uuidv4 } from 'uuid';
import { restrict } from '$lib/server/security/guards';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { logger } from '$lib/server/logger';
import { validateAndGetUserId } from '$lib/server/security/auth-utils';
import { SystemRole } from '$lib/types/roles';


export const load = restrict(
    async ({ locals }) => {
        // Initialize the form with the schema and defaults
        const form = await superValidate(zod(createWhatsAppAccountSchema), {
            defaults: {
                description: ''
            }
        });
        
        try {
            // Get the authenticated user ID
            const user_id = await validateAndGetUserId(locals);
            logger.debug(`Loading WhatsApp account creation page for user: ${user_id}`);
            
            return { 
                form, 
                clientId: null
            };
        } catch (err) {
            logger.error(`Error in WhatsApp account creation page load: ${JSON.stringify(err)}`);
            // We don't throw here to allow the page to load even if there's an error
            return { 
                form,
                clientId: null
            };
        }
    },
    [SystemRole.USER, SystemRole.ADMIN] // Allow both user and admin roles to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Main action for creating a WhatsApp account
    createAccount: restrict(
        async ({ request, locals, auth }) => {
            // Validate form submission
            const form = await superValidate(request, zod(createWhatsAppAccountSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Get prisma client from locals
                const prisma = locals.prisma;
                
                // Get user info from the enhanced event
                const userInfo = auth.user;
                
                // Log form data for debugging
                logger.debug(`WhatsApp account creation form data: ${JSON.stringify(form.data)}`);
                
                // Validate client ID
                if (!form.data.client_id) {
                    return fail(400, message(form, 'Client ID is required. Please authenticate with WhatsApp first.', { status: 'error' }));
                }
                
                // Get client info from the WhatsApp account manager
                const client = whatsAppAccountManager.getClient(form.data.client_id);
                
                if (!client) {
                    logger.warn(`WhatsApp client not found: ${form.data.client_id}`);
                    return fail(400, message(form, 'WhatsApp connection not found. Please reconnect and try again.', { status: 'error' }));
                }
                
                const clientInfo = client ? client.getInfo() : null;
                
                // Create the WhatsApp account in the database
                const account = await prisma.whatsAppAccount.create({
                    data: {
                        description: form.data.description,
                        client_id: form.data.client_id,
                        createdBy: userInfo.id,
                        phoneNumber: form.data.phoneNumber || clientInfo?.phoneNumber || 'Unknown',
                        name: form.data.name || clientInfo?.pushName
                    }
                });
                
                // Update the client's account ID
                if (client) {
                    await client.setAccountId(account.id);
                }

                // Create a success message with the form data
                const successForm = message(form, 'WhatsApp account created successfully!', { status: 'success' });
                
                // Add the account data to the form data object directly
                const formWithAccount = {
                    ...successForm,
                    account
                };
                
                logger.info(`Successfully created WhatsApp account: ${account.id}`);
                
                // Return the form object with success and account data
                return formWithAccount;
            } catch (err) {
                // Log the full error for debugging
                logger.error(`Error creating WhatsApp account: ${JSON.stringify(err)}`);
                
                // Provide a more specific error message if possible
                const errorMessage = err instanceof Error 
                    ? `Failed to create WhatsApp account: ${err.message}` 
                    : 'Failed to create WhatsApp account. Please try again.';
                
                return fail(500, message(form, errorMessage, { status: 'error' }));
            }
        },
        [SystemRole.USER, SystemRole.ADMIN] // Allow both user and admin roles to access this action
    ),
    
    // Action to request a new QR code via SSE
    requestQRCode: restrict(
        async ({ locals, auth }) => {
            try {
                // Get the authenticated user ID
                const userInfo = auth.user;
                
                // Create a new WhatsApp client
                const { clientId } = await whatsAppAccountManager.createNewClient(userInfo.id);
                
                logger.debug(`Created new WhatsApp client with ID ${clientId} for user ${userInfo.id}`);
                return { success: true, clientId };
            } catch (err) {
                logger.error(`Error requesting QR code: ${JSON.stringify(err)}`);
                return fail(500, { error: 'Failed to request QR code' });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN] // Allow both user and admin roles to access this action
    )
} satisfies Actions;
