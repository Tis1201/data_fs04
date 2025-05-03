import type { PageServerLoad } from './$types';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { deviceSchema } from '$lib/schemas/device';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '../../users/schema';

// Define table options for Devices
const table_options = {
    modelName: 'device',
    searchableFields: ['name', 'id', 'hardwareId'],
    allowedFilters: ['types', 'statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'types': { field: 'deviceType', operator: 'in' },
        'statuses': { field: 'status', operator: 'in' }
    }
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }) => {
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        return {
            devices: result.records,
            meta: result.meta
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Create
     ******************************************************************************************/
    create: restrict(
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(deviceSchema));
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                const { name, deviceType, description, model, manufacturer, hardwareId } = form.data;

                // Check if device with same name already exists
                const existingDevice = await locals.prisma.device.findFirst({
                    where: { name }
                });

                if (existingDevice) {
                    return fail(400, {
                        form,
                        error: "Device with this name already exists"
                    });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }
                
                // Create device
                const device = await locals.prisma.device.create({
                    data: {
                        name,
                        deviceType,
                        description,
                        model,
                        manufacturer,
                        hardwareId,
                        status: 'ACTIVE',
                        createdBy: auth.user.id
                    }
                });

                return { 
                    form,
                    success: true
                };
            } catch (e) {
                logger.error('Error creating device:', e);
                return fail(500, {
                    form,
                    error: "Failed to create device"
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to create devices
    ),
    
    /*******************************************************************************************
     * Toggle Status
     ******************************************************************************************/
    toggleStatus: restrict(
        async ({ request, locals }) => {
            try {
                // Get the device ID and new status from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const status = data.get('status')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Device ID is required' });
                }
                
                if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
                    return fail(400, { error: 'Invalid status value' });
                }
                
                // Check if device exists
                const device = await locals.prisma.device.findUnique({
                    where: { id }
                });
                
                if (!device) {
                    return fail(404, { error: 'Device not found' });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }
                
                // Update the device status
                await locals.prisma.device.update({
                    where: { id },
                    data: { 
                        status,
                        updatedAt: new Date() 
                    }
                });

                logger.info(`Device ${id} status changed to ${status}`);
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling device status: ${err}`);
                return fail(500, { error: 'Failed to update device status' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to toggle device status
    ),

    /**
     * Delete device
     */
    delete: restrict(
        async ({ request, locals }) => {
            try {
                // Get the device ID from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Device ID is required' });
                }
                
                // Check if device exists
                const device = await locals.prisma.device.findUnique({
                    where: { id }
                });
                
                if (!device) {
                    return fail(404, { error: 'Device not found' });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }
                
                // Delete the device
                await locals.prisma.device.delete({
                    where: { id }
                });

                logger.info('Device deleted successfully:', { deviceId: id });
                
                // Return success response
                return {
                    success: true,
                    message: 'Device deleted successfully'
                };
            } catch (e) {
                logger.error('Error deleting device:', e);
                if (e.code === 'P2025') {
                    return fail(404, {
                        error: 'Device not found'
                    });
                }
                return fail(500, {
                    error: 'Failed to delete device'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete devices
    )
};
