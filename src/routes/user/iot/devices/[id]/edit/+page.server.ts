import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { deviceEditSchema } from '../schema';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { createSuccessResponse } from '$lib/types/api';

export const load = restrict(
    async ({ params, locals }) => {
        try {
            // Load existing device
            const device = await locals.prisma.device.findUnique({
                where: { 
                    id: params.id,
                    // Only allow users to edit their own devices or devices in their account
                    OR: [
                        { createdBy: locals.user?.id },
                        { accountId: locals.user?.currentAccountId }
                    ]
                },
                select: {
                    id: true,
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
                throw error(404, "Device not found or you don't have access to it");
            }

            const form = await superValidate(
                {
                    id: device.id,
                    name: device.name,
                    description: device.description || "",
                    status: device.status,
                },
                zod(deviceEditSchema)
            );

            return {
                form,
                device
            };
        } catch (e) {
            logger.error('Error loading device for edit:', e);
            throw error(500, 'Failed to load device');
        }
    },
    [SystemRole.USER] // Allow regular users to access this route
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Update device data
     */
    save: restrict(
        async ({ request, params, locals }) => {
            const id = params.id;

            const form = await superValidate(request, zod(deviceEditSchema));
            logger.debug(`Device update form data: ${JSON.stringify(form)}`);

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Debug logging to understand the access check
                logger.debug(`User access check - userId: ${locals.user?.id}, currentAccountId: ${locals.user?.currentAccountId}`);
                
                // First check if device exists and user has access to it
                const existingDevice = await locals.prisma.device.findUnique({
                    where: { 
                        id,
                        OR: [
                            { createdBy: locals.user?.id },
                            { accountId: locals.user?.currentAccountId }
                        ]
                    }
                });

                logger.debug(`Device lookup result: ${existingDevice ? 'found' : 'not found'}`);

                if (!existingDevice) {
                    // Try to find the device by ID first to see if it exists
                    const deviceById = await locals.prisma.device.findUnique({
                        where: { id }
                    });
                    
                    if (!deviceById) {
                        return fail(404, {
                            form,
                            error: 'Device not found'
                        });
                    }
                    
                    // Device exists but user doesn't have access
                    logger.warn(`User ${locals.user?.id} attempted to access device ${id} but lacks permission`);
                    return fail(403, {
                        form,
                        error: 'You don\'t have access to this device'
                    });
                }

                // Prepare update data - only name and description are editable by users
                const updateData = {
                    name: form.data.name,
                    description: form.data.description || null,
                    // Regular users can't change status
                };

                logger.debug(`Update data prepared:`, updateData);

                // Update the device
                logger.debug(`Attempting to update device ${id}...`);
                const device = await locals.prisma.device.update({
                    where: { id },
                    data: updateData
                });
                logger.debug(`Device update successful:`, device);

                logger.debug(`Starting audit log...`);
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: existingDevice,
                    newData: device,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                logger.debug(`Audit log completed`);

                // Return success response
                logger.debug(`Device update completed successfully`);
                return message(
                    form,
                    createSuccessResponse('Device updated successfully!', {
                        details: `Device '${device.name}' has been updated.`,
                        data: {
                            id: device.id,
                            name: device.name
                        }
                    })
                );
            } catch (e) {
                logger.debug(`Caught error in device update:`, e);
                logger.error(`Error updating device:`, e);
                return fail(500, {
                    form,
                    error: 'Failed to update device'
                });
            }
        },
        [SystemRole.USER]
    )
};
