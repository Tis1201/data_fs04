import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { whatsappAccountSchema, createForm } from './schema';
import { superValidate } from 'sveltekit-superforms/server';
import { restrict } from '$lib/server/security/guards';
import { zod } from 'sveltekit-superforms/adapters';
import { message } from 'sveltekit-superforms/server';
import { createSuccessResponse } from '$lib/types/api';
import { handleFormError } from '$lib/server/errors/errorHandlers';

/**
 * Load WhatsApp account data for viewing/editing
 */
export const load = restrict(
    async ({ params, locals, auth }: any) => {
        const id = params.id;
        const userInfo = auth.user;
        
        // Handle "new" case
        if (id === 'new') {
            const form = await createForm(null);
            return {
                form,
                account: null,
                meta: {
                    title: 'Create WhatsApp Account',
                    description: 'Create a new WhatsApp account'
                }
            };
        }
        
        try {
            // Get account data from database with user-level security
            const account = await locals.prisma.whatsAppAccount.findUnique({
                where: { 
                    id,
                    // Ensure the account belongs to the user's account
                    account: {
                        members: {
                            some: {
                                userId: userInfo.id
                            }
                        }
                    }
                }
            });
            
            if (!account) {
                throw error(404, {
                    message: 'WhatsApp account not found',
                    code: 'WHATSAPP_ACCOUNT_NOT_FOUND'
                });
            }
            
            // Create form with account data
            const form = await superValidate(account, zod(whatsappAccountSchema));
            
            return {
                form,
                account,
                meta: {
                    title: `Edit: ${account.name}`,
                    description: `Edit WhatsApp account ${account.name}`
                }
            };
        } catch (err) {
            console.error(`Error loading WhatsApp account ${id}:`, err);
            throw error(500, {
                message: 'Failed to load WhatsApp account',
                code: 'WHATSAPP_ACCOUNT_LOAD_ERROR'
            });
        }
    },
    ['USER', 'ADMIN']
) satisfies PageServerLoad;

/**
 * Actions for saving WhatsApp account data
 */
export const actions = {
    /**
     * Save WhatsApp account data
     */
    save: restrict(
        async ({ request, params, locals, auth }) => {
            const id = params.id;
            const userInfo = auth.user;
            const form = await superValidate(request, zod(whatsappAccountSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                const data = form.data;
                
                // Create or update account
                if (id === 'new') {
                    // Create new account
                    const account = await locals.prisma.whatsAppAccount.create({
                        data: {
                            phoneNumber: data.phoneNumber,
                            name: data.name,
                            description: data.description || '',
                            status: data.status,
                            createdBy: userInfo.id,
                            updatedBy: userInfo.id,
                            // Connect to user's account
                            account: {
                                connect: {
                                    id: userInfo.accountId
                                }
                            }
                        }
                    });
                    
                    return message(
                        form,
                        createSuccessResponse('WhatsApp account created successfully!', {
                            details: `WhatsApp account '${account.name}' has been created.`,
                            data: {
                                id: account.id,
                                name: account.name
                            }
                        })
                    );
                } else {
                    // Verify user has access to this account
                    const existingAccount = await locals.prisma.whatsAppAccount.findUnique({
                        where: { 
                            id,
                            account: {
                                members: {
                                    some: {
                                        userId: userInfo.id
                                    }
                                }
                            }
                        }
                    });
                    
                    if (!existingAccount) {
                        return fail(404, { 
                            form,
                            error: 'WhatsApp account not found or you do not have permission to edit it'
                        });
                    }
                    
                    // Update existing account
                    const account = await locals.prisma.whatsAppAccount.update({
                        where: { id },
                        data: {
                            phoneNumber: data.phoneNumber,
                            name: data.name,
                            description: data.description || '',
                            status: data.status,
                            updatedBy: userInfo.id
                        }
                    });
                    
                    return message(
                        form,
                        createSuccessResponse('WhatsApp account updated successfully!', {
                            details: `WhatsApp account '${account.name}' has been updated.`,
                            data: {
                                id: account.id,
                                name: account.name
                            }
                        })
                    );
                }
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to save WhatsApp account. Please try again later.',
                    action: 'whatsapp account save'
                });
            }
        }
    )
};
