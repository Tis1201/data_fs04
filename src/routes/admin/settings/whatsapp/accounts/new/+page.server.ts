import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { superValidate, message } from 'sveltekit-superforms/server';
import { createWhatsAppAccountSchema } from '$lib/schemas/whatsapp-account';
import { zod } from 'sveltekit-superforms/adapters';
import { v4 as uuidv4 } from 'uuid';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../../users/schema';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';
import { logger } from '$lib/server/logger';

export const load = restrict(
    async ({ locals }) => {
        // Initialize the form with the schema and defaults
        const form = await superValidate(zod(createWhatsAppAccountSchema), {
            defaults: {
                description: ''
            }
        });
        
        try {
            // Create a new WhatsApp client directly in the load function
            // This will trigger QR code generation which will be sent via WebSocket
            // Let Baileys generate the client ID
            const auth = await locals.auth.validate();

            const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient();

            logger.debug(`Created WhatsApp client with userId: ${auth.user.id} during page load`);
            
            console.log(`Created WhatsApp client with ID ${clientId} during page load`);
            
            return { 
                form,
                clientId
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
    createAccount: async ({ request, locals }) => {
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
                return fail(400, { 
                    form: message(form, 'Client ID is required. Please authenticate with WhatsApp first.', { status: 'error' })
                });
            }
            
            // Get client info from WhatsApp manager
            const client = whatsAppAccountManager.getClient(form.data.client_id);
            const clientInfo = client ? client.getInfo() : null;
            
            console.log('Client info for database:', {
                clientId: form.data.client_id,
                phoneNumber: form.data.phoneNumber || clientInfo?.phoneNumber,
                name: form.data.name || clientInfo?.pushName
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
                await client.setAccountId(account.id);
            }

            // Return the form object with success and account data
            return { 
                form: message(form, 'WhatsApp account created successfully!', { status: 'success' }),
                account
            };
        } catch (err) {
            console.error('Error creating WhatsApp account:', err);
            return fail(500, { 
                form: message(form, 'Failed to create WhatsApp account. Please try again.', { status: 'error' }) 
            });
        }
    },
    
    // Action to request a new QR code
    requestQRCode: async ({ locals }) => {
        try {
            // Create a new WhatsApp client and let Baileys generate the client ID
            const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient();
            
            console.log(`Created new WhatsApp client with ID ${clientId} via requestQRCode action`);
            return { success: true, clientId };
        } catch (error) {
            console.error('Error requesting QR code:', error);
            return fail(500, { error: 'Failed to request QR code' });
        }
    }
} satisfies Actions;
