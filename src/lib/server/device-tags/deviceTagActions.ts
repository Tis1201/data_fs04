import { fail, error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';

/**
 * Create device tag actions factory
 * Per structural standard: create{Resource}Actions pattern
 */
export function createDeviceTagActions(options: {
    checkOwnership?: boolean;
}): {
    update: (args: { params: { id: string }; request: Request; locals: any }) => Promise<any>;
    delete: (args: { request: Request; locals: any }) => Promise<any>;
} {
    return {
        /**
         * Update device tag action
         * Used by both detail pages (admin and user)
         */
        update: async ({
            params,
            request,
            locals
        }: {
            params: { id: string };
            request: Request;
            locals: any;
        }) => {
            const { id } = params;

            // Import deviceTagSchema dynamically
            const { deviceTagSchema } = await import('../../../routes/admin/iot/device_tags/new/device-tag');
            const form = await superValidate(request, zod(deviceTagSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Get authenticated user info
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    throw new FormValidationError(
                        'You must be logged in to update a device tag',
                        'AUTH_REQUIRED',
                        401
                    );
                }

                // Get account ID for ownership check (user routes)
                let accountId: string | undefined;
                if (options.checkOwnership) {
                    if (!auth.currentAccount || !auth.currentAccount.account) {
                        throw error(400, 'No current account selected. Please select an account first.');
                    }
                    accountId = auth.currentAccount.account.id;
                }

                // Fetch the existing device tag
                const deviceTag = await locals.prisma.deviceTag.findUnique({
                    where: { id }
                });

                if (!deviceTag) {
                    throw new FormValidationError(
                        'Device tag not found',
                        'DEVICE_TAG_NOT_FOUND',
                        404
                    );
                }

                // Check ownership if required
                if (options.checkOwnership && accountId) {
                    if (deviceTag.accountId !== accountId) {
                        throw new FormValidationError(
                            'You do not have permission to update this device tag',
                            'FORBIDDEN',
                            403
                        );
                    }
                }

                // Create update object
                const { name, description } = form.data;

                // Check if name changed and if new name already exists (unique per account, case-insensitive)
                if (name.toLowerCase() !== deviceTag.name.toLowerCase()) {
                    const existingDeviceTag = await locals.prisma.deviceTag.findFirst({
                        where: {
                            id: { not: id },
                            accountId: deviceTag.accountId,
                            name: {
                                equals: name,
                                mode: 'insensitive'
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

                // Update the device tag
                const updatedDeviceTag = await locals.prisma.deviceTag.update({
                    where: { id },
                    data: {
                        name,
                        description
                    }
                });

                logger.info(`Device tag updated: ${deviceTag.id} by user ${auth.user.id}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'DeviceTag',
                    recordId: deviceTag.id,
                    oldData: deviceTag,
                    newData: updatedDeviceTag,
                    userId: (locals as any).user?.id || auth.user.id,
                    ipAddress: (locals as any).ipAddress,
                    prisma: locals.prisma
                });

                // Return success response
                return message(
                    form,
                    createSuccessResponse('Device tag updated successfully!', {
                        details: `Device tag '${deviceTag.name}' has been updated.`,
                        data: {
                            id: deviceTag.id,
                            name: updatedDeviceTag.name,
                            description: updatedDeviceTag.description
                        }
                    })
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    defaultMessage: 'Failed to update device tag. Please try again later.',
                    action: 'Device tag update'
                });
            }
        },

        /**
         * Delete device tag action
         * Used by both list pages (admin and user)
         */
        delete: async ({ request, locals }: { request: Request; locals: any }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();

                if (!id) {
                    return fail(400, { error: 'Device Tag ID is required' });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Get account ID for ownership check (user routes)
                let accountId: string | undefined;
                if (options.checkOwnership) {
                    if (!auth.currentAccount || !auth.currentAccount.account) {
                        return fail(400, { error: 'No current account selected. Please select an account first.' });
                    }
                    accountId = auth.currentAccount.account.id;
                }

                // Check if device tag exists and get it for audit log
                const deviceTag = await locals.prisma.deviceTag.findUnique({
                    where: { id }
                });

                if (!deviceTag) {
                    return fail(404, { 
                        error: 'Device Tag not found' 
                    });
                }

                // Check ownership if required
                if (options.checkOwnership && accountId) {
                    if (deviceTag.accountId !== accountId) {
                        return fail(403, { 
                            error: 'You do not have permission to delete this device tag' 
                        });
                    }
                }

                // Delete the device tag
                await locals.prisma.deviceTag.delete({
                    where: { id }
                });

                logger.info(`Device tag ${id} deleted by user ${auth.user.id}`);

                // Log audit for deletion
                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'DeviceTag',
                    recordId: id,
                    oldData: deviceTag,
                    newData: null,
                    userId: auth.user.id,
                    ipAddress: (locals as any).ipAddress,
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error deleting device tag: ${err}`);
                return fail(500, { error: 'Failed to delete device tag' });
            }
        }
    };
}

