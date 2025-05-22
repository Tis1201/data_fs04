import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { emailSchema } from './email';

export const load = restrict(
    async ({ locals }) => {
        try {
            // Create a form based on the schema with defaults
            const form = await superValidate(zod(emailSchema), {
                id: 'email-form'
            });
            
            return {
                form
            };
        } catch (err) {
            logger.error(`Error loading email provider form: ${err}`);
            throw error(500, 'Failed to load email provider form');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals, getClientAddress }) => {
            // Validate the form data
            const form = await superValidate(request, zod(emailSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Get current user ID for tracking
                const userId = locals.user?.id;
                if (!userId) {
                    return fail(401, { form, error: 'User not authenticated' });
                }
                
                // Create the email provider
                const emailProvider = await locals.prisma.emailServiceProvider.create({
                    data: {
                        name: form.data.name,
                        type: form.data.type,
                        isDefault: form.data.isDefault,
                        isActive: form.data.isActive,
                        
                        // Common fields
                        fromEmail: form.data.fromEmail,
                        fromName: form.data.fromName,
                        
                        // SMTP specific fields
                        smtpHost: form.data.type === 'smtp' ? form.data.smtpHost : null,
                        smtpPort: form.data.type === 'smtp' ? form.data.smtpPort : null,
                        smtpUser: form.data.type === 'smtp' ? form.data.smtpUser : null,
                        smtpPass: form.data.type === 'smtp' ? form.data.smtpPass : null,
                        smtpSecure: form.data.type === 'smtp' ? form.data.smtpSecure : true,
                        smtpAuth: form.data.type === 'smtp' ? form.data.smtpAuth : true,
                        
                        // API-based providers
                        apiKey: form.data.type === 'resend' ? form.data.apiKey : null,
                        apiSecret: null,
                        domain: null,
                        region: null,
                        
                        // Webhook configuration
                        webhookUrl: form.data.webhookUrl,
                        webhookKey: form.data.webhookKey,
                        
                        // Tracking
                        createdBy: userId,
                        updatedBy: userId,
                        
                        // Status
                        status: "ACTIVE"
                    }
                });
                
                // If this provider is set as default, update all other providers to not be default
                if (form.data.isDefault) {
                    await locals.prisma.emailServiceProvider.updateMany({
                        where: {
                            id: {
                                not: emailProvider.id
                            }
                        },
                        data: {
                            isDefault: false,
                            updatedBy: userId
                        }
                    });
                }
                
                logger.info(`Email provider created: ${emailProvider.id}`);
                
                return message(
                    form,
                    createSuccessResponse('Email provider created successfully', {
                        details: `Email provider '${emailProvider.name}' has been created.`,
                        data: { providerId: emailProvider.id, name: emailProvider.name }
                    })
                );
            } catch (err) {
                // Use the handleFormError utility to simplify error handling
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to create email provider. Please try again.',
                    action: 'email provider creation'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
