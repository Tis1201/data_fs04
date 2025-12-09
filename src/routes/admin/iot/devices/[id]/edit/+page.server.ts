import { error, fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { deviceEditSchema } from '../schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { createSuccessResponse } from '$lib/types/api';

export const load = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, locals } = event;
        const id = params.id;

        if (!id) {
            throw error(400, 'Missing device id');
        }
        try {
            // Load existing device
            const device = await locals.prisma.device.findUnique({
                where: { id },
                select: {
                    id: true,
                    tags: true,
                    name: true,
                    description: true,
                    status: true,
                    deviceType: true,
                    model: true,
                    manufacturer: true,
                    osVersion: true,
                    firmwareVersion: true,
                    hardwareId: true,
                    wifiMac: true,
                    lanMac: true,
                    ipAddress: true,
                    createdAt: true,
                    updatedAt: true,
                    lastUsedAt: true,
                    createdBy: true,
                    user: {
                        select: {
                            name: true,
                            email: true
                        }
                    }
                }
            });

            if (!device) {
                throw error(404, "Device not found");
            }

            const form = await superValidate(
                {
                    id: device.id,
                    name: device.name,
                    description: device.description || '',
                    status: device.status
                },
                zod(deviceEditSchema)
            );

            return {
                form,
                device
            };
        } catch (e) {
            logger.error('Error loading device for edit:', { error: e });
            throw error(500, 'Failed to load device');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update device data
     */
    save: restrict(
        async (event: RequestEvent) => {
            const { request, params, locals } = event;
            const id = params.id;

            if (!id) {
                return fail(400, { form: null, error: 'Missing device id' });
            }

            const form = await superValidate(request, zod(deviceEditSchema));
            logger.debug('Update device form data:', form);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // First check if device exists
                const existingDevice = await locals.prisma.device.findUnique({
                    where: { id }
                });

                if (!existingDevice) {
                    return fail(404, {
                        form,
                        error: 'Device not found'
                    });
                }

                const { name, description, status } = form.data;
                
                const updatedDevice = await locals.prisma.device.update({
                    where: { id },
                    data: {
                        name: name,
                        description: description || null,
                        status: status
                    }
                });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: existingDevice,
                    newData: updatedDevice,
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: locals.prisma
                });

                // Return success response
                logger.debug(`Device update completed successfully`);
                return message(
                    form,
                    createSuccessResponse('Device updated successfully!', {
                        details: `Device '${updatedDevice.name}' has been updated.`,
                        data: {
                            id: updatedDevice.id,
                            name: updatedDevice.name
                        }
                    })
                );
            } catch (e) {
                logger.error('Error updating device:', { error: e });
                return fail(500, {
                    form,
                    error: 'Failed to update device'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),
    
    cancel: restrict(
        async (event: RequestEvent) => {
            const { params } = event;
            if (!params.id) {
                throw error(400, 'Missing device id');
            }
            // Redirect back to the device detail page
            throw redirect(303, `/admin/iot/device/${params.id}`);
        },
        [SystemRole.ADMIN]
    )
};
