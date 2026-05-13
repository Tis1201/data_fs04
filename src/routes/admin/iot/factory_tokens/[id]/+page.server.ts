import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedEvent, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { factoryTokenSchema } from '$lib/schemas/factory-token';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { upsertFactoryTokenCronjob } from '$lib/server/factory-tokens/cronjobManager';

export const actions: Actions = {
    updateToken: restrict(
        async (event: AuthenticatedEvent) => {
            const { params, locals, request } = event;
            const { id } = params;
            
            // Validate form data
            const form = await superValidate(request, zod(factoryTokenSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Fetch the existing factory token
                const existingToken = await locals.prisma.factoryToken.findUnique({
                    where: { id }
                });
                
                if (!existingToken) {
                    throw new FormValidationError(
                        'Factory token not found',
                        'TOKEN_NOT_FOUND',
                        404
                    );
                }
                
                // Get authenticated user info
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    throw new FormValidationError(
                        'You must be logged in to update a factory token',
                        'AUTH_REQUIRED',
                        401
                    );
                }
                if (!locals.user) {
                    throw new FormValidationError(
                        'User context missing',
                        'AUTH_CONTEXT_REQUIRED',
                        401
                    );
                }

                // Create update object
                const { data } = form;
                const updateData = {
                    name: data.name,
                    hardwareModel: data.hardwareModel,
                    firmwareVersion: data.firmwareVersion,
                    batchNumber: data.batchNumber || null,
                    expiresAt: data.expiresAt,
                    notes: data.notes || null,
                    // Use the connect pattern for relations
                    factory_signing_key: {
                        connect: { id: data.factory_signing_key_id }
                    }
                    // The FactoryToken model doesn't have an updatedById field
                };

                // Update the factory token
                const factoryToken = await locals.prisma.factoryToken.update({
                    where: { id },
                    data: updateData
                });
                
                logger.info(`Factory token updated: ${factoryToken.id} by user ${auth.user.id}`);

                // Always update cronjob when token is updated (handles expiration changes and status updates)
                    await upsertFactoryTokenCronjob(
                        locals.prisma,
                        factoryToken.id,
                        factoryToken.expiresAt,
                        auth.user.id
                    );
                
                // If token is already expired and not used, mark it as used
                const now = new Date();
                if (factoryToken.expiresAt <= now && !factoryToken.isUsed) {
                    await locals.prisma.factoryToken.update({
                        where: { id: factoryToken.id },
                        data: { 
                            isUsed: true,
                            usedAt: new Date()
                        }
                    });
                    logger.info(`Auto-marked expired factory token as used: ${factoryToken.id}`);
                }

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'FactoryToken',
                    recordId: factoryToken.id,
                    oldData: existingToken,
                    newData: factoryToken,
                    userId: locals.user?.id ?? auth.user.id,
                    ipAddress: (locals as any)?.ipAddress,
                    prisma: locals.prisma
                })

                // Return success response
                return message(
                    form,
                    createSuccessResponse('Factory token updated successfully!', {
                        details: `Factory token '${factoryToken.name}' has been updated.`,
                        data: {
                            id: factoryToken.id,
                            hardwareModel: factoryToken.hardwareModel,
                            firmwareVersion: factoryToken.firmwareVersion,
                            expiresAt: factoryToken.expiresAt
                        }
                    })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to update factory token. Please try again later.',
                    action: 'factory token update'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    

};

export const load = restrict(
    async (event: AuthenticatedLoadEvent) => {
        const { params, locals } = event;
        const { id } = params;

        try {
            // Fetch the factory token by ID
            const factoryToken = await locals.prisma.factoryToken.findUnique({
                where: { id },
                include: {
                    factory_signing_key: {
                        select: {
                            id: true,
                            keyId: true,
                            isPrimary: true
                        }
                    },
                    device: true
                }
            });
            
            if (!factoryToken) {
                throw error(404, 'Factory token not found');
            }
            
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
            
            // Create form data from existing token
            const formData = {
                name: factoryToken.name || '',
                hardwareModel: factoryToken.hardwareModel,
                firmwareVersion: factoryToken.firmwareVersion,
                batchNumber: factoryToken.batchNumber || '',
                expiresAt: factoryToken.expiresAt,
                notes: factoryToken.notes || '',
                factory_signing_key_id: factoryToken.factory_signing_key_id
            };
            
            const form = await superValidate(formData, zod(factoryTokenSchema));
            
            return {
                form,
                factoryToken,
                signingKeys,
                meta: {
                    title: `Factory Token: ${factoryToken.name || factoryToken.hardwareModel}`,
                    description: `Manage factory token for ${factoryToken.hardwareModel}`
                }
            };
        } catch (err) {
            logger.error(`Error loading factory token ${id}: ${err}`);
            throw error(500, 'Failed to load factory token');
        }
    },
    [SystemRole.ADMIN]
);
