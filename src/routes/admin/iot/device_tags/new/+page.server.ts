import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse, createErrorResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deviceTagSchema } from './device-tag';

export const load = restrict(
    async ({ locals }:any) => {
        // Initialize the Device Tag form with the schema and defaults
        const deviceTagForm = await superValidate(zod(deviceTagSchema), {
            defaults: {
                name: '',
                description: '',
                accountId: ''
            }
        });

        // Load accounts for dropdown
        const accounts = await locals.prisma.account.findMany({
            where: { isSystem: false },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });

        const accountOptions = accounts.map((a: any) => ({ value: a.id, label: a.name }));

        return {
            deviceTagForm,
            accountOptions
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

                let account;
                let accountId = form.data.accountId;
                try {
                    if (accountId && accountId.trim() !== '') {
                        account = await locals.prisma.account.findUnique({ where: { id: accountId } });
                        if (!account) {
                            return message(
                                form,
                                createErrorResponse(
                                    'Invalid account',
                                    'INVALID_ACCOUNT',
                                    { details: `The selected account with ID '${accountId}' does not exist.` }
                                )
                            );
                        }
                    } else {
                        account = await locals.prisma.account.findFirst({ where: { isSystem: true } });
                        if (!account) {
                            logger.error('System account not found in database');
                            return message(
                                form,
                                createErrorResponse(
                                    'System account not found',
                                    'SYSTEM_ACCOUNT_NOT_FOUND',
                                    {
                                        details:
                                            'The system account does not exist. Please run the database seed to create it.'
                                    }
                                )
                            );
                        }
                    }

                    accountId = account.id; // canonicalize
                } catch (acctErr) {
                    logger.error(`Error verifying account: ${String(acctErr)}`);
                    return message(
                        form,
                        createErrorResponse(
                            'Error verifying account',
                            'ACCOUNT_VERIFICATION_ERROR',
                            { details: 'Failed to verify the selected account. Please try again.' }
                        )
                    );
                }

                // Verify that the device tag name not exists
                const existingDeviceTag = await locals.prisma.deviceTag.findFirst({
                    where: {
                        accountId,
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
                        name,
                        description,
                        accountId
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
                });

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
