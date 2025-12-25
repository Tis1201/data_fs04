import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { factoryTokenSchema } from '$lib/schemas/factory-token';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { upsertFactoryTokenCronjob } from '$lib/server/factory-tokens/cronjobManager';

export const load = restrict(
    async ({ locals }:any) => {
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
    createToken: restrict(
        async ({ request, locals }:any) => {
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
                
                // Build factory JWT claims for mass production
                const iat = Math.floor(Date.now() / 1000);
                const exp = Math.floor(new Date(expiresAt).getTime() / 1000);
                const jti = randomUUID();
                const payload: Record<string, unknown> = {
                    aud: 'device-register',
                    typ: 'factory',
                    iat,
                    exp,
                    jti,
                    scope: 'device:register',
                    hardwareModel,
                    firmwareVersion
                };

                // Sign token with FACTORY signing key
                const signedToken = jwt.sign(payload, signingKey.privateKey, {
                    algorithm: (signingKey.algorithm as jwt.Algorithm) || 'RS256',
                    keyid: signingKey.keyId
                });

                // Create factory token (persist signed token)
                const factoryToken = await locals.prisma.factoryToken.create({
                    data: {
                        name,
                        token: signedToken,
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

                // Check if token is already expired and mark as used if so
                const currentTime = new Date();
                if (factoryToken.expiresAt <= currentTime && !factoryToken.isUsed) {
                    await locals.prisma.factoryToken.update({
                        where: { id: factoryToken.id },
                        data: { 
                            isUsed: true,
                            usedAt: new Date()
                        }
                    });
                    logger.info(`Auto-marked expired factory token as used on creation: ${factoryToken.id}`);
                }

                // Create cronjob for token expiration (always create, even if expired - handles future updates)
                await upsertFactoryTokenCronjob(
                    locals.prisma,
                    factoryToken.id,
                    factoryToken.expiresAt,
                    userInfo.id
                );

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'FactoryToken',
                    recordId: factoryToken.id,
                    oldData: null,
                    newData: factoryToken,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })

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
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
