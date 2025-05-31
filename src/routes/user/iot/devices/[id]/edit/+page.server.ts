import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { deviceEditSchema } from '../schema';

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
                // Start a transaction to ensure data consistency
                return await locals.prisma.$transaction(async (tx) => {
                    // First check if device exists and user has access to it
                    const existingDevice = await tx.device.findUnique({
                        where: { 
                            id,
                            OR: [
                                { createdBy: locals.user?.id },
                                { accountId: locals.user?.currentAccountId }
                            ]
                        }
                    });

                    if (!existingDevice) {
                        return fail(404, {
                            form,
                            error: 'Device not found or you don\'t have access to it'
                        });
                    }

                    // Prepare update data - only name and description are editable by users
                    const updateData = {
                        name: form.data.name,
                        description: form.data.description,
                        // Regular users can't change status
                    };

                    // Update the device
                    await tx.device.update({
                        where: { id },
                        data: updateData
                    });

                    // Redirect back to the device detail page after successful update
                    throw redirect(303, `/user/iot/devices/${id}`);
                });
            } catch (e) {
                if (e instanceof Response) {
                    throw e; // This is the redirect
                }
                
                logger.error(`Error updating device: ${JSON.stringify(e)}`);
                return fail(500, {
                    form,
                    error: 'Failed to update device'
                });
            }
        },
        [SystemRole.USER]
    )
};
