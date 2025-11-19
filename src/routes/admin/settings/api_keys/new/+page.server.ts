import { fail, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { generateId } from 'lucia';
import { SystemRole } from '$lib/types/roles';
import { createApiKeySchema } from './schema';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

export const load = restrict(
    async ({ locals }) => {
        // Generate a 32-character API key
        const apiKey = generateId(32);
        
        // Initialize the form with the schema and defaults
        const form = await superValidate(zod(createApiKeySchema), {
            defaults: {
                name: '',
                description: '',
                active: true,
                expiresAt: null,
                apiKey // Include the generated API key
            }
        });
        
        return { form };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions = {
    save: restrict(
        async ({ request, locals }) => {
            logger.info('Save API key action triggered');
            
            const form = await superValidate(request, zod(createApiKeySchema));
            logger.debug('Create API key form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const prisma = locals.prisma;
                const auth = await locals.auth.validate();

                if (!auth?.user) {
                    throw new Error('User not found');
                }

                // Check if user already has 10 or more API keys
                const existingKeysCount = await prisma.apiKey.count({
                    where: { userId: auth.user.id }
                });

                if (existingKeysCount >= 10) {
                    return fail(400, {
                        form,
                        message: {
                            type: 'error' as const,
                            text: 'API key limit reached',
                            details: 'You have reached the maximum limit of 10 API keys. Please delete some keys before creating new ones.',
                            code: 'API_KEY_LIMIT_REACHED',
                            requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                            timestamp: new Date().toISOString()
                        }
                    });
                }

                const newApiKey = await prisma.apiKey.create({
                    data: {
                        name: form.data.name,
                        description: form.data.description || null,
                        userId: auth.user.id,
                        active: form.data.active,
                        expiresAt: form.data.expiresAt || null,
                        key: generateId(32) // Generate a new 32-character key
                    }
                });

                logger.info('API key created successfully:', { apiKeyId: newApiKey.id });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'ApiKey',
                    recordId: newApiKey.id,
                    oldData: null,
                    newData: newApiKey,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return { 
                    form,
                    success: true,
                    apiKey: newApiKey.key // Return the actual key only once
                };
            } catch (error) {
                logger.error('Error creating API key:', error);
                
                let errorMessage = {
                    type: 'error' as const,
                    text: 'Unable to create API key',
                    details: 'An unexpected error occurred while processing your request.'
                };

                if (error.code === 'P2002') {
                    errorMessage.text = 'API key already exists';
                    errorMessage.details = `An API key with this ${error.meta?.target?.[0] || 'identifier'} already exists.`;
                } else if (error.code === 'FORBIDDEN') {
                    errorMessage.text = 'Permission denied';
                    errorMessage.details = 'You do not have permission to perform this action.';
                } else if (error.message === 'User not found') {
                    errorMessage.text = 'User not found';
                    errorMessage.details = 'Please log in again to create an API key.';
                }

                return fail(400, {
                    form,
                    message: {
                        ...errorMessage,
                        code: error.code || 'UNKNOWN_ERROR',
                        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create API keys
    )
};
