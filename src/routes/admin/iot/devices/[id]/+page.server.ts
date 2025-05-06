import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { deviceEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../../users/schema';

export const load = restrict(
    async ({ params, locals }) => {
        try {
            // Load existing device
            const device = await locals.prisma.device.findUnique({
                where: { id: params.id },
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
                    apiKey: true,
                    apiKeyCreatedAt: true,
                    apiKeyRotatedAt: true,
                    connected: true,
                    connectedAt: true,
                    disconnectedAt: true,
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
                    description: device.description || "",
                    status: device.status,
                    deviceType: device.deviceType || "",
                    model: device.model || "",
                    manufacturer: device.manufacturer || "",
                    osVersion: device.osVersion || "",
                    firmwareVersion: device.firmwareVersion || "",
                    hardwareId: device.hardwareId || "",
                    wifiMac: device.wifiMac || "",
                    lanMac: device.lanMac || "",
                    ipAddress: device.ipAddress || "",
                    apiKey: device.apiKey || "",
                }, 
                zod(deviceEditSchema)
            );

            return {
                form,
                device
            };
        } catch (e) {
            logger.error('Error loading device:', e);
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
                // Start a transaction to ensure data consistency
                return await locals.prisma.$transaction(async (tx) => {
                    // First check if device exists
                    const existingDevice = await tx.device.findUnique({
                        where: { id }
                    });
                    
                    if (!existingDevice) {
                        return fail(404, {
                            form,
                            error: 'Device not found'
                        });
                    }
                    
                    // Prepare update data
                    const updateData = {
                        name: form.data.name,
                        description: form.data.description || null,
                        status: form.data.status,
                        deviceType: form.data.deviceType || null,
                        model: form.data.model || null,
                        manufacturer: form.data.manufacturer || null,
                        osVersion: form.data.osVersion || null,
                        firmwareVersion: form.data.firmwareVersion || null,
                        hardwareId: form.data.hardwareId || null,
                        wifiMac: form.data.wifiMac || null,
                        lanMac: form.data.lanMac || null,
                        ipAddress: form.data.ipAddress || null,
                    };
                    
                    // Update device
                    const updatedDevice = await tx.device.update({
                        where: { id },
                        data: updateData
                    });
                    
                    return {
                        form,
                        success: true,
                        message: 'Device updated successfully'
                    };
                });
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
    
    /**
     * Generate new API key for the device
     */
    generateApiKey: restrict(
        async ({ params, locals }) => {
            const id = params.id;
            
            try {
                // Generate a new API key
                const apiKey = crypto.randomUUID();

                logger.info(`Generating new API key for device ${id}: ${apiKey}`);
                
                // Update device with new API key
                // const updatedDevice = await locals.prisma.device.update({
                //     where: { id },
                //     data: {
                //         apiKey,
                //         apiKeyCreatedAt: new Date(),
                //         apiKeyRotatedAt: new Date()
                //     }
                // });
                
                return {
                    success: true,
                    message: 'API key generated successfully',
                    apiKey
                };
            } catch (e) {
                logger.error('Error generating API key:', e);
                return fail(500, {
                    error: 'Failed to generate API key'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
