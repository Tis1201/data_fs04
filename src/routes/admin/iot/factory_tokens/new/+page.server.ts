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

export const load = restrict(
    async ({ locals }) => {
        // Initialize the factory token form with the schema and defaults
        const factoryTokenForm = await superValidate(zod(factoryTokenSchema), {
            defaults: {
                serialNumber: '',
                hardwareModel: '',
                firmwareVersion: '',
                batchNumber: '',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
                notes: ''
            }
        });

        return {
            factoryTokenForm
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
                // Return a properly formatted error message for the form handler
                return fail(401, {
                    form,
                    success: false,
                    message: {
                        type: 'error',
                        text: 'Authentication Required',
                        details: 'You must be logged in to create a factory token',
                        code: 'AUTH_REQUIRED',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            const { serialNumber, hardwareModel, firmwareVersion, batchNumber, expiresAt, notes } = form.data;

            // Check if token with same serial number already exists
            const existingToken = await locals.prisma.factoryToken.findFirst({
                where: { serialNumber }
            });

            if (existingToken) {
                logger.warn(`Factory token with serial number ${serialNumber} already exists`);
                
                // Return a properly formatted error message for the form handler
                return fail(400, {
                    form,
                    success: false,
                    message: {
                        type: 'error',
                        text: 'Validation Failed',
                        details: 'Factory token with this serial number already exists',
                        code: 'DUPLICATE_SERIAL',
                        timestamp: new Date().toISOString()
                    }
                });
            }

            // Generate a unique token ID
            const tokenId = crypto.randomUUID();
            
            // Create factory token
            const factoryToken = await locals.prisma.factoryToken.create({
                data: {
                    tokenId,
                    serialNumber,
                    hardwareModel,
                    firmwareVersion,
                    batchNumber,
                    expiresAt,
                    notes,
                    issuedBy: userInfo.id,
                    issuedAt: new Date()
                }
            });

            logger.info(`Factory token created: ${factoryToken.id} by user ${userInfo.id}`);

            // Return success response with the form and additional data
            return {
                form,
                success: true,
                message: {
                    type: 'success',
                    text: 'Factory token created successfully!',
                    timestamp: new Date().toISOString()
                },
                factoryToken: {
                    id: factoryToken.id,
                    tokenId: factoryToken.tokenId,
                    serialNumber: factoryToken.serialNumber,
                    hardwareModel: factoryToken.hardwareModel
                }
            };
        } catch (error) {
            logger.error(`Error creating factory token: ${JSON.stringify(error)}`);
            
            // Return a properly formatted error message for the form handler
            return fail(500, {
                form,
                success: false,
                message: {
                    type: 'error',
                    text: 'System Error',
                    details: 'Failed to create factory token. Please try again later.',
                    code: 'SYSTEM_ERROR',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
};
