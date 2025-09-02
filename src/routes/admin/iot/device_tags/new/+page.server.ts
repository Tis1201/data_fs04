import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deviceTagSchema } from './device-tag';
import type NameWithIdLink from '$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte';

export const load = restrict(
    async ({ locals }:any) => {
        // Initialize the Device Tag form with the schema and defaults
        const deviceTagForm = await superValidate(zod(deviceTagSchema), {
            defaults: {
                name: '',
                description: ''
            }
        });

        return {
            deviceTagForm
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    // Action for creating a new Device Tag
    createTag: restrict(
        async ({ request, locals }:any) => {
            // Validate the form data against the schema
            const form = await superValidate(request, zod(deviceTagSchema));

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
                        'You must be logged in to create a Device Tag',
                        'AUTH_REQUIRED',
                        401
                    );
                }

                const { name, description } = form.data;

                // Verify that the device tag name not exists
                const existingDeviceTag = await locals.prisma.deviceTag.findFirst({
                    where: {
                        name: {
                            equals: name,
                            mode: "insensitive"
                        }
                    }
                });

                if (existingDeviceTag) {
                    // Throw a FormValidationError that will be caught and handled by handleFormError
                    throw new FormValidationError(
                        'Device tag with this name already exists',
                        'INVALID_DEVICE_TAG',
                        409
                    );
                }
                
                // Create Device Tag
                const deviceTag = await locals.prisma.deviceTag.create({
                    data: {
                        name: name,
                        description: description
                    }
                });

                logger.info(`Device Tag created: ${deviceTag.id} by user ${userInfo.id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'DeviceTag',
                    recordId: deviceTag.id,
                    oldData: null,
                    newData: deviceTag,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })

                // Return success response with the form and additional data
                return message(
                    form,
                    createSuccessResponse('Device Tag created successfully!', {
                        details: `Device Tag '${deviceTag.name}' has been created.`,
                        data: {
                            id: deviceTag.id,
                            name: deviceTag.name,
                            description: deviceTag.description
                        }
                    })
                );
            } catch (err) {
                // Use the handleFormError utility to simplify error handling
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to create Device Tag. Please try again later.',
                    action: 'Device Tag creation'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
