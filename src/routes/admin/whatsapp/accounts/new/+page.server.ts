import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getEnhancedPrisma } from '$lib/server/prisma';
import { superValidate, message } from 'sveltekit-superforms/server';
import { createWhatsAppAccountSchema } from '$lib/schemas/whatsapp-account';
import { zod } from 'sveltekit-superforms/adapters';





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
            const prisma = getEnhancedPrisma({
                id: auth.user.id,
                rolesString: auth.user.rolesString,
                systemRole: auth.user.systemRole
            });
            
            // Log user info for debugging
            console.log(auth.user)
            
            // Create the WhatsApp account
            const account = await prisma.whatsAppAccount.create({
                data: {
                    phoneNumber: form.data.phoneNumber,
                    description: form.data.description,
                    createdBy: auth.user.id
                }
            });
            
            return message(form, 'WhatsApp account created successfully');
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
