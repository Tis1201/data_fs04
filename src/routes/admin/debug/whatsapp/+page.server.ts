import { getEnhancedPrisma } from '$lib/server/prisma';
import type { PageServerLoad } from './$types';
import { getWhatsAppClient, sendWhatsAppMessage } from '$lib/server/bailey/client';
import { fail, type Actions } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';

const messageSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required'),
    recipient: z.string().min(1, 'Recipient is required'),
    message: z.string().min(1, 'Message is required')
});

export const load: PageServerLoad = async ({ locals }) => {
    const session = await locals.auth.validate();
    if (!session) {
        return {
            accounts: []
        };
    }

    // Get prisma client with admin privileges
    const prisma = getEnhancedPrisma({
        id: session.user.userId,
        rolesString: session.user.rolesString,
        systemRole: session.user.systemRole
    });

    // Get all WhatsApp accounts
    const accounts = await prisma.whatsAppAccount.findMany({
        select: {
            id: true,
            phoneNumber: true,
            description: true,
            client_id: true,
            client_status: true
        },
        orderBy: {
            phoneNumber: 'asc'
        }
    });

    const form = await superValidate(zod(messageSchema));

    return {
        accounts,
        form
    };
};

export const actions: Actions = {
    sendMessage: async ({ request, locals }) => {
        const session = await locals.auth.validate();
        if (!session) {
            return fail(401, { message: 'Unauthorized' });
        }

        const form = await superValidate(request, zod(messageSchema));
        if (!form.valid) {
            return fail(400, { form });
        }

        const { accountId, recipient, message } = form.data;

        // Get prisma client with admin privileges
        const prisma = getEnhancedPrisma({
            id: session.user.userId,
            rolesString: session.user.rolesString,
            systemRole: session.user.systemRole
        });

        // Get the account
        const account = await prisma.whatsAppAccount.findUnique({
            where: {
                id: accountId
            }
        });

        if (!account || !account.client_id) {
            return fail(404, { 
                form,
                error: 'Account not found or client ID not available'
            });
        }

        try {
            // Format the recipient number (remove any spaces, add country code if needed)
            let formattedRecipient = recipient.replace(/\s+/g, '');
            if (!formattedRecipient.includes('@')) {
                // If not already in JID format, format as phone number
                if (!formattedRecipient.startsWith('+')) {
                    formattedRecipient = '+' + formattedRecipient;
                }
                // Convert to WhatsApp JID format
                formattedRecipient = formattedRecipient.substring(1) + '@s.whatsapp.net';
            }

            // Send the message
            const result = await sendWhatsAppMessage(account.client_id, formattedRecipient, message);
            
            if (result) {
                return { 
                    form,
                    success: true 
                };
            } else {
                return fail(500, { 
                    form,
                    error: 'Failed to send message' 
                });
            }
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            return fail(500, { 
                form,
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
        }
    }
};
