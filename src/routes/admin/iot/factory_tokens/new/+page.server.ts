import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { factoryTokenSchema } from '$lib/schemas/factory-token';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';
import { logger } from '$lib/server/logger';
import { validateAndGetUserId, validateAuth } from '$lib/server/security/auth-utils';
import { z } from 'zod';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';

export const load = restrict(
    async ({ locals }) => {
        // Get available JWT signing keys for factory tokens
        const signingKeys = await locals.prisma.jwtSigningKey.findMany({
            where: {
                keyType: 'FACTORY',
                isActive: true
            },
            select: {
                id: true,
                keyId: true,
                isPrimary: true
            },
            orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        // Initialize the factory token form with the schema and defaults
        const factoryTokenForm = await superValidate(zod(factoryTokenSchema), {
            defaults: {
                name: '',
                hardwareModel: '',
                firmwareVersion: '',
                batchNumber: '',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
                notes: '',
                factory_signing_key_id: signingKeys.length > 0 ? signingKeys[0].id : ''
            }
        });

        return {
            factoryTokenForm,
            signingKeys
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for creating a new factory token
    createToken: async ({ request, locals }) => {
        // Validate the form data against the schema
        const form = await superValidate(request, zod(factoryTokenSchema));

        // If validation fails, return the form with errors
        if (!form.valid) {
            return fail(400, { form });
        }

        try {
            // Get authenticated user
            const auth = await locals.auth.validate();
            const userInfo = auth?.user;

            if (!userInfo) {
                // Throw a FormValidationError that will be caught and handled by handleFormError
                throw new FormValidationError(
                    'You must be logged in to create a factory token',
                    'AUTH_REQUIRED',
                    401
                );
            }

            const { name, hardwareModel, firmwareVersion, batchNumber, expiresAt, notes, factory_signing_key_id } = form.data;

            // Verify that the signing key exists and is active
            const signingKey = await locals.prisma.jwtSigningKey.findUnique({
                where: {
                    id: factory_signing_key_id,
                    isActive: true,
                    keyType: 'FACTORY'
                }
            });

            if (!signingKey) {
                logger.warn(`Invalid or inactive signing key: ${factory_signing_key_id}`);
                
                // Throw a FormValidationError that will be caught and handled by handleFormError
                throw new FormValidationError(
                    'Selected signing key is invalid or inactive',
                    'INVALID_SIGNING_KEY',
                    400
                );
            }
            
            // Create factory token
            const factoryToken = await locals.prisma.factoryToken.create({
                data: {
                    name,
                    hardwareModel,
                    firmwareVersion,
                    batchNumber,
                    expiresAt,
                    notes,
                    issuedBy: userInfo.id,
                    issuedAt: new Date(),
                    factory_signing_key_id
                }
            });

            logger.info(`Factory token created: ${factoryToken.id} by user ${userInfo.id}`);

            // Return success response with the form and additional data
            return message(
                form,
                createSuccessResponse('Factory token created successfully!', {
                    details: `Factory token '${factoryToken.name}' has been created.`,
                    data: {
                        id: factoryToken.id,
                        hardwareModel: factoryToken.hardwareModel,
                        firmwareVersion: factoryToken.firmwareVersion,
                        expiresAt: factoryToken.expiresAt
                    }
                })
            );
        } catch (err) {
            // Use the handleFormError utility to simplify error handling
            return handleFormError({
                error: err,
                form,
                prisma: locals.prisma,
                defaultMessage: 'Failed to create factory token. Please try again later.',
                action: 'factory token creation'
            });
        }
    }
};
