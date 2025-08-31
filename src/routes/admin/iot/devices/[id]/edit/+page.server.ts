import { error, fail, redirect } from '@sveltejs/kit';
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
    async ({ params, locals }) => {
        try {
            // Load existing device
            const device = await locals.prisma.device.findUnique({
                where: { id: params.id },
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

            const availableTags = await locals.prisma.deviceTag.findMany({
                select: {
                    id: true,
                    name: true
                }
            })

            const deviceTagIds = device.tags.map(tag => tag.id);

            const form = await superValidate(
                {
                    id: device.id,
                    name: device.name,
                    description: device.description || "",
                    status: device.status,
                    tagIds: deviceTagIds
                },
                zod(deviceEditSchema)
            );
            
            

            return {
                form,
                device,
                deviceTagIds,
                availableTags
            };
        } catch (e) {
            logger.error('Error loading device for edit:', e);
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
        async ({ request, params, locals }) => {
            const id = params.id;

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

                const { name, description, status, tagIds } = form.data;
                
                let tagIdObjects: { id: string }[] = [];

                tagIds.forEach(tagId => {
                    if (tagId.trim()) {
                        tagIdObjects.push({ id: tagId })
                    }
                })
                const updatedDevice = await locals.prisma.device.update({
                    where: { id },
                    data: {
                        name: name,
                        description: description || null,
                        status: status,
                        tags: {
                            set: tagIdObjects
                        }
                    }
                });

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: existingDevice,
                    newData: updatedDevice,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })

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
                logger.error('Error updating device:', e);
                return fail(500, {
                    form,
                    error: 'Failed to update device'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),
    
    cancel: restrict(
        async ({ params }) => {
            // Redirect back to the device detail page
            throw redirect(303, `/admin/iot/device/${params.id}`);
        },
        [SystemRole.ADMIN]
    )
};
