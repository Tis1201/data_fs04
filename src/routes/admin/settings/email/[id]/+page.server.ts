import { error, fail, type RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedEvent, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { emailSettingsSchema } from '../../email/schema';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

type EmailSettingsFormData = z.infer<typeof emailSettingsSchema>;

export const actions: Actions = {
    updateEmail: restrict(
        async ({ params, locals, request, auth }: AuthenticatedEvent) => {
            const id = params.id;

            if (!id) {
                return fail(400, { error: 'Email provider ID is required' });
            }
            
            // Validate form data
            const form = await superValidate<EmailSettingsFormData>(request, zod(emailSettingsSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }

            if (!auth?.user) {
                return fail(401, { error: 'Unauthorized' });
            }

            const userId = auth!.user.id;
            
            // Prisma client is available in locals.prisma
            
            try {
                // Fetch the existing email settings first
                const existingEmail = await locals.prisma.emailServiceProvider.findUnique({
                    where: { id }
                });
                
                if (!existingEmail) {
                    return fail(404, { form, error: 'Email settings not found' });
                }
                
                // Ensure the type cannot be changed
                if (form.data.type !== existingEmail.type) {
                    return message(form, {
                        type: 'error',
                        text: 'Email provider type cannot be changed'
                    }, { status: 400 });
                }

                const { data } = form;
                const updateData: any = {
                    name: data.name,
                    description: data.description,
                    fromEmail: data.fromEmail,
                    fromName: data.fromName
                };
                
                if (data.type === 'smtp') {
                    updateData.smtpHost = data.host;
                    updateData.smtpPort = data.port;
                    updateData.smtpUser = data.username;
                    if (data.password?.trim()) {
                        updateData.smtpPass = data.password;
                    }
                    updateData.smtpSecure = data.secure;
                    updateData.smtpAuth = true;
                } else {
                    if (data.apiKey?.trim()) {
                        updateData.apiKey = data.apiKey;
                    }
                }

                // Update the email settings
                const result = await locals.prisma.emailServiceProvider.update({
                    where: { id },
                    data: updateData
                });
                
                // Log the update
                logger.info(`Email settings updated: ${result.id} (${result.name})`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'EmailServiceProvider',
                    recordId: id,
                    oldData: existingEmail,
                    newData: result,
                    userId,
                    ipAddress: locals.requestContext?.ip,
                    prisma: locals.prisma
                })

                // Return success with the updated form
                return { form };
            } catch (err) {
                logger.error(`Error updating email settings: ${err}`);
                
                return message(form, {
                    type: 'error',
                    text: 'Failed to update email settings: ' + (err instanceof Error ? err.message : 'Unknown error')
                }, { status: 500 });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    deleteEmail: restrict(
        async ({ params, locals, auth }: AuthenticatedEvent) => {
            const id = params.id;

            if (!id) {
                return fail(400, { error: 'Email provider ID is required' });
            }
            
            // Prisma client is available in locals.prisma
            
            try {
                if (!auth?.user) {
                    return fail(401, { error: 'Unauthorized' });
                }
                const userId = auth!.user.id;

                // Check if the email settings exist
                const emailSettings = await locals.prisma.emailServiceProvider.findUnique({
                    where: { id }
                });
                
                if (!emailSettings) {
                    return fail(404, { error: 'Email settings not found' });
                }
                
                // Delete the email settings
                await locals.prisma.emailServiceProvider.delete({
                    where: { id }
                });
                
                logger.info(`Email settings deleted: ${emailSettings.id} (${emailSettings.name})`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'EmailServiceProvider',
                    recordId: id,
                    oldData: emailSettings,
                    newData: null,
                    userId,
                    ipAddress: locals.requestContext?.ip,
                    prisma: locals.prisma
                })
                
                return {
                    success: true,
                    message: 'Email settings deleted successfully'
                };
            } catch (err) {
                logger.error(`Error deleting email settings: ${err}`);
                return fail(500, { 
                    error: 'Failed to delete email settings: ' + (err instanceof Error ? err.message : 'Unknown error')
                });
            }
        },
        [SystemRole.ADMIN]
    )
};

export const load = restrict(
    async ({ params, locals }: AuthenticatedLoadEvent) => {
        const { id } = params;

        try {
            
            // Fetch the email settings by ID first
            const emailSettings = await locals.prisma.emailServiceProvider.findUnique({
                where: { id }
            });
            
            if (!emailSettings) {
                throw error(404, 'Email settings not found');
            }
            
            // Create a form based on the schema with existing data
            const baseDescription = (emailSettings as { description?: string | null }).description ?? '';
            let formData: EmailSettingsFormData;

            if (emailSettings.type === 'smtp') {
                formData = {
                    type: 'smtp',
                    name: emailSettings.name,
                    description: baseDescription,
                    fromEmail: emailSettings.fromEmail || '',
                    fromName: emailSettings.fromName || '',
                    host: emailSettings.smtpHost || '',
                    port: emailSettings.smtpPort || 0,
                    username: emailSettings.smtpUser || '',
                    password: '', // Don't prefill password
                    secure: emailSettings.smtpSecure || false
                };
            } else {
                formData = {
                    type: 'resend',
                    name: emailSettings.name,
                    description: baseDescription,
                    fromEmail: emailSettings.fromEmail || '',
                    fromName: emailSettings.fromName || '',
                    apiEndpoint: (emailSettings as { apiEndpoint?: string | null }).apiEndpoint || '',
                    apiKey: '' // Don't prefill API key
                };
            }
            
            const form = await superValidate(formData, zod(emailSettingsSchema));
            
            // Remove sensitive information from the response
            const { password: _password, secretAccessKey: _secretAccessKey, apiKey: _apiKey, ...rest } = emailSettings as typeof emailSettings & {
                password?: string;
                secretAccessKey?: string;
                apiKey?: string;
            };
            
            return {
                form,
                emailSettings: rest,
                meta: {
                    title: `Email Settings: ${emailSettings.name}`,
                    description: `Viewing email settings for ${emailSettings.name}`
                }
            };
        } catch (err) {
            logger.error(`Error loading email settings ${id}: ${err}`);
            throw error(500, 'Failed to load email settings');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;
