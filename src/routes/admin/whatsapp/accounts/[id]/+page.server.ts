import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { whatsappAccountSchema, createForm } from './schema';
import { superValidate } from 'sveltekit-superforms/server';
import { restrict } from '$lib/server/security/guards';
import { zod } from 'sveltekit-superforms/adapters';

/**
 * Load WhatsApp account data for viewing/editing
 */
export const load = restrict(
    async ({ params, locals }) => {
        const id = params.id;
        
        // Handle "new" case
        if (id === 'new') {
            const form = await createForm(null);
            return {
                form,
                account: null
            };
        }
        
        try {
            // Get account data from database
            const account = await locals.prisma.whatsAppAccount.findUnique({
                where: { id }
            });
            
            if (!account) {
                throw error(404, 'WhatsApp account not found');
            }
            
            // Create form with account data
            const form = await superValidate(account, zod(whatsappAccountSchema));
            
            return {
                form,
                account
            };
        } catch (e) {
            console.error('Error loading WhatsApp account:', e);
            throw error(500, 'Failed to load WhatsApp account');
        }
    },
    ['ADMIN'] // Only allow admin role to access this route
) satisfies PageServerLoad;

/**
 * Actions for saving WhatsApp account data
 */
export const actions = {
    /**
     * Save WhatsApp account data
     */
    save: restrict(
        async ({ request, params, locals }) => {
            const id = params.id;
            const form = await superValidate(request, zod(whatsappAccountSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                const data = form.data;
                
                // Create or update account
                if (id === 'new') {
                    // Create new account
                    await locals.prisma.whatsAppAccount.create({
                        data: {
                            phoneNumber: data.phoneNumber,
                            name: data.name,
                            description: data.description || '',
                            status: data.status
                        }
                    });
                } else {
                    // Update existing account
                    await locals.prisma.whatsAppAccount.update({
                        where: { id },
                        data: {
                            phoneNumber: data.phoneNumber,
                            name: data.name,
                            description: data.description || '',
                            status: data.status
                        }
                    });
                }
                
                return {
                    form,
                    success: true
                };
            } catch (e) {
                console.error('Error saving WhatsApp account:', e);
                return fail(500, {
                    form,
                    error: 'Failed to save WhatsApp account'
                });
            }
        },
        ['ADMIN'] // Only allow admin role to save accounts
    )
};
