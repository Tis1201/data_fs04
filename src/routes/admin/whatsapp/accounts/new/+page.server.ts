import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { superValidate, message } from 'sveltekit-superforms/server';
import { createWhatsAppAccountSchema } from '$lib/schemas/whatsapp-account';
import { zod } from 'sveltekit-superforms/adapters';
import { v4 as uuidv4 } from 'uuid';





export const load = (async ({ locals }) => {
    const auth = await locals.auth.validate();
    if (!auth?.user || auth.user.systemRole !== 'ADMIN') {
        throw error(403, 'Not authorized to create WhatsApp accounts');
    }
    
    console.log(auth.user);
    
    // Initialize the form with the schema and defaults
    const form = await superValidate(zod(createWhatsAppAccountSchema), {
        defaults: {
            phoneNumber: '',
            description: ''
        }
    });
    
    return { form };
}) satisfies PageServerLoad;

export const actions: Actions = {
    default: async ({ request, locals }) => {
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
            console.log(auth.user)
            
            // Create the WhatsApp account with the client_id from the form
            // The client_id should have been set in the frontend when the WebSocket connection was authenticated
            if (!form.data.client_id) {
                return fail(400, { 
                    form: message(form, 'Client ID is required. Please authenticate with WhatsApp first.', { status: 'error' })
                });
            }
            
            const account = await prisma.whatsAppAccount.create({
                data: {
                    phoneNumber: form.data.phoneNumber,
                    description: form.data.description,
                    name: form.data.name, // Add the name field from the form
                    createdBy: auth.user.id,
                    client_id: form.data.client_id
                }
            });
            
            // Return the account ID along with the success message
            // This will be used by the client to establish the WebSocket connection
            return { 
                form: message(form, 'WhatsApp account created successfully'),
                accountId: account.id 
            };
        } catch (err) {
            console.error('Error creating WhatsApp account:', err);
            
            // Handle database errors
            return fail(500, { 
                form,
                error: 'Failed to create WhatsApp account'
            });
        }
    }
};
