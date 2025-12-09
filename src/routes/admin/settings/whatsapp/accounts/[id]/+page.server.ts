import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { whatsappAccountSchema, createForm } from './schema';
import { superValidate } from 'sveltekit-superforms/server';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { zod } from 'sveltekit-superforms/adapters';
import { SystemRole } from '$lib/types/roles';
import { randomUUID } from 'crypto';

/**
 * Load WhatsApp account data for viewing/editing
 */
export const load = restrict(
    async ({ params, locals }: AuthenticatedLoadEvent) => {
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
            const form = await superValidate(
                {
                    id: account.id,
                    phoneNumber: account.phoneNumber ?? '',
                    name: account.name ?? '',
                    description: account.description ?? '',
                    status: (account.status?.toLowerCase() as 'active' | 'inactive' | 'pending') ?? 'inactive',
                    createdAt: account.createdAt,
                    updatedAt: account.updatedAt
                },
                zod(whatsappAccountSchema)
            );
            
            return {
                form,
                account
            };
        } catch (e) {
            console.error('Error loading WhatsApp account:', e);
            throw error(500, 'Failed to load WhatsApp account');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/**
 * Actions for saving WhatsApp account data
 */
export const actions = {
    /**
     * Save WhatsApp account data
     */
    save: restrict(
        async ({ request, params, locals }: AuthenticatedEvent) => {
            const id = params.id;
            const form = await superValidate(request, zod(whatsappAccountSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                const data = form.data;
                const auth = await locals.auth.validate();
                const userId = auth?.user?.id ?? locals.user?.id;

                if (!userId) {
                    return fail(401, { form, error: 'You must be logged in' });
                }
                
                // Create or update account
                if (id === 'new') {
                    // Create new account
                    await locals.prisma.whatsAppAccount.create({
                        data: {
                            client_id: randomUUID(),
                            createdBy: userId,
                            phoneNumber: data.phoneNumber,
                            name: data.name,
                            description: data.description || '',
                            status: data.status.toUpperCase()
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
                            status: data.status.toUpperCase()
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
        [SystemRole.ADMIN] // Only allow admin role to save accounts
    )
};
