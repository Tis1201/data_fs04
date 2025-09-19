import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deviceTagSchema } from '../new/device-tag';

export const actions: Actions = {
    updateTag: restrict(
        async ({ params, locals, request }) => {
            const { id } = params;
            
            // Validate form data
            const form = await superValidate(request, zod(deviceTagSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }
            
            try {
                // Fetch the existing Device Tag
                const deviceTag = await locals.prisma.deviceTag.findUnique({
                    where: { id }
                });
                
                if (!deviceTag) {
                    throw new FormValidationError(
                        'Device Tag not found',
                        'TOKEN_NOT_FOUND',
                        404
                    );
                }
                
                // Get authenticated user info
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    throw new FormValidationError(
                        'You must be logged in to update a Device Tag',
                        'AUTH_REQUIRED',
                        401
                    );
                }


                // Create update object
                const { name, description } = form.data;

                if (name.toLowerCase() != deviceTag.name.toLowerCase()) {
                    const existingDeviceTag = await locals.prisma.deviceTag.findFirst({
                        where: {
                            accountId: deviceTag.accountId,
                            name: {
                                equals: name,
                                mode: "insensitive"
                            }
                        }
                    });
                    if (existingDeviceTag) {
                        throw new FormValidationError(
                            'Device tag with this name already exists',
                            'INVALID_DEVICE_TAG',
                            409
                        );
                    }
                } 

                // Update the Device Tag
                const updatedDeviceTag = await locals.prisma.deviceTag.update({
                    where: { id },
                    data: {
                        name,
                        description
                    }
                });
                
                logger.info(`Device Tag updated: ${deviceTag.id} by user ${auth.user.id}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'DeviceTag',
                    recordId: deviceTag.id,
                    oldData: deviceTag,
                    newData: updatedDeviceTag,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })

                // Return success response
                return message(
                    form,
                    createSuccessResponse('Device Tag updated successfully!', {
                        details: `Device Tag '${deviceTag.name}' has been updated.`,
                        data: {
                            id: deviceTag.id,
                            name: deviceTag.name,
                            description: deviceTag.description,
                        }
                    })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to update Device Tag. Please try again later.',
                    action: 'Device Tag update'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    

};

export const load = restrict(
    async ({ params, locals }) => {
        const { id } = params;

        try {
            // Fetch the Device Tag by ID
            const deviceTag = await locals.prisma.deviceTag.findUnique({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    devices: true,
                    account: true
                }
            });
            
            if (!deviceTag) {
                throw error(404, {
                    message: 'Device Tag not found',
                    code: 'DEVICE_TAG_NOT_FOUND'
                });
            }
            
            // Create form data from existing token
            const formData = {
                name: deviceTag.name,
                description: deviceTag.description || ''
            };
            
            const form = await superValidate(formData, zod(deviceTagSchema));
            
            return {
                form,
                deviceTag
            };
        } catch (err) {
            logger.error(`Error loading Device Tag ${id}: ${err}`);
            throw error(500, {
                message: 'Failed to load Device Tag',
                code: 'DEVICE_TAG_LOAD_ERROR'
            });
        }
    },
    [SystemRole.ADMIN]
);
