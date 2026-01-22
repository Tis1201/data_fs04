import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { getStatusBeforeToggled } from '$lib/utils';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { deviceSchema } from '$lib/schemas/device';

/**
 * Create device actions factory
 * Per structural standard: create{Resource}Actions pattern
 */
export function createDeviceActions(options: {
    checkOwnership?: boolean;
    enableCreate?: boolean; // Admin only - create device action
}): {
    delete: (args: { request: Request; locals: any }) => Promise<any>;
    toggleStatus: (args: { request: Request; locals: any }) => Promise<any>;
    assignTags: (args: { request: Request; locals: any }) => Promise<any>;
    updateDevice: (args: { request: Request; locals: any }) => Promise<any>;
    create?: (args: { request: Request; locals: any }) => Promise<any>;
} {
    return {
        /**
         * Delete device action
         * Used by both list pages (admin and user)
         */
        delete: async ({ request, locals }: { request: Request; locals: any }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Device ID is required' });
                }
                
                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Fetch device first
                const device = await locals.prisma.device.findUnique({ 
                    where: { id } 
                });

                if (!device) {
                    return fail(404, { error: 'Device not found' });
                }

                // Ownership check for user routes
                if (options.checkOwnership) {
                    let authorized = false;
                    if (device.createdBy === auth.user.id) {
                        authorized = true;
                    } else if (device.accountId) {
                        const membership = await locals.prisma.accountMembership.findFirst({
                            where: {
                                accountId: device.accountId,
                                userId: auth.user.id,
                                role: { in: ['OWNER', 'ADMIN'] }
                            }
                        });
                        authorized = !!membership;
                    }

                    if (!authorized) {
                        return fail(403, { error: 'You do not have permission to delete this device' });
                    }
                }

                // Publish device:unclaimed SSE before deletion
                try {
                    const { MessageFactory, SystemUser } = await import('$lib/server/messaging/interfaces/message');
                    const { publisher } = await import('$lib/server/messaging/core/publisher');
                    const message = MessageFactory.createSystemMessage(
                        'device:unclaimed',
                        `subscription:device:${id}`,
                        {
                            action: 'unclaimed',
                            deviceId: id,
                            reason: 'deleted',
                            timestamp: new Date().toISOString()
                        },
                        SystemUser,
                        { echoToSender: false }
                    );
                    await publisher.publish(message);
                } catch (pubErr) {
                    logger.warn(`Failed to publish device:unclaimed for ${id}: ${String(pubErr)}`);
                }

                // Delete the device
                await locals.prisma.device.delete({ where: { id } });

                logger.info(`Device ${id} deleted successfully`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: device,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });
                
                return {
                    success: true,
                    message: 'Device deleted successfully'
                };
            } catch (e: any) {
                logger.error(`Error deleting device: ${e?.message || String(e)}`);
                if (e.code === 'P2025') {
                    return fail(404, { error: 'Device not found' });
                }
                return fail(500, { error: 'Failed to delete device' });
            }
        },

        /**
         * Toggle device status action
         * Used by both list pages (admin and user)
         */
        toggleStatus: async ({ request, locals }: { request: Request; locals: any }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const status = data.get('status')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Device ID is required' });
                }
                
                if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
                    return fail(400, { error: 'Invalid status value' });
                }
                
                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Check if device exists
                const deviceWhere: any = { id };
                
                // Ownership check for user routes
                if (options.checkOwnership) {
                    deviceWhere.OR = [
                        { createdBy: auth.user.id },
                        {
                            account: {
                                members: {
                                    some: {
                                        userId: auth.user.id
                                    }
                                }
                            }
                        }
                    ];
                }

                const device = await locals.prisma.device.findFirst({
                    where: deviceWhere
                });
                
                if (!device) {
                    return fail(404, { 
                        error: options.checkOwnership 
                            ? 'Device not found or you do not have permission to modify it'
                            : 'Device not found'
                    });
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

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: getStatusBeforeToggled(status),
                    newData: { status },
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling device status: ${err}`);
                return fail(500, { error: 'Failed to update device status' });
            }
        },

        /**
         * Assign tags to device action
         * Used by both list pages (admin and user)
         */
        assignTags: async ({ request, locals }: { request: Request; locals: any }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const tagIdsRaw = data.get('tagIds')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Device ID is required' });
                }
                
                let tagIds: string[] = [];
                try {
                    tagIds = tagIdsRaw ? JSON.parse(tagIdsRaw) : [];
                } catch {
                    return fail(400, { error: 'Invalid tag IDs format' });
                }
                
                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Check if device exists and user has permission
                const deviceWhere: any = { id };
                
                // Ownership check for user routes
                if (options.checkOwnership) {
                    deviceWhere.OR = [
                        { createdBy: auth.user.id },
                        {
                            account: {
                                members: {
                                    some: {
                                        userId: auth.user.id
                                    }
                                }
                            }
                        }
                    ];
                }

                const device = await locals.prisma.device.findFirst({
                    where: deviceWhere,
                    include: { tags: true }
                });
                
                if (!device) {
                    return fail(404, { 
                        error: options.checkOwnership 
                            ? 'Device not found or you do not have permission to modify it'
                            : 'Device not found'
                    });
                }

                // Update device tags - connect new tags while keeping existing ones
                await locals.prisma.device.update({
                    where: { id },
                    data: {
                        tags: {
                            connect: tagIds.map(tagId => ({ id: tagId }))
                        },
                        updatedAt: new Date()
                    }
                });

                logger.info(`Tags assigned to device ${id}: ${tagIds.join(', ')}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: { tags: device.tags.map(t => t.id) },
                    newData: { tags: [...device.tags.map(t => t.id), ...tagIds] },
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });
                
                return { success: true };
            } catch (err) {
                logger.error(`Error assigning tags to device: ${err}`);
                return fail(500, { error: 'Failed to assign tags to device' });
            }
        },

        /**
         * Update device action
         * Used by both list pages (admin and user) for Edit Device modal
         */
        updateDevice: async ({ request, locals }: { request: Request; locals: any }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Device ID is required' });
                }
                
                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth?.user) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Check if device exists and user has permission
                const deviceWhere: any = { id };
                
                // Ownership check for user routes
                if (options.checkOwnership) {
                    deviceWhere.OR = [
                        { createdBy: auth.user.id },
                        {
                            account: {
                                members: {
                                    some: {
                                        userId: auth.user.id
                                    }
                                }
                            }
                        }
                    ];
                }

                const device = await locals.prisma.device.findFirst({
                    where: deviceWhere,
                    include: { tags: true }
                });
                
                if (!device) {
                    return fail(404, { 
                        error: options.checkOwnership 
                            ? 'Device not found or you do not have permission to modify it'
                            : 'Device not found'
                    });
                }

                // Extract form data
                const name = data.get('name')?.toString() || device.name;
                const status = data.get('status')?.toString() || device.status;
                const description = data.get('description')?.toString() || device.description;
                
                // Parse tags
                let tagIds: string[] = [];
                const tagsRaw = data.get('tags')?.toString();
                if (tagsRaw) {
                    try {
                        tagIds = JSON.parse(tagsRaw);
                    } catch {
                        // Keep existing tags if parsing fails
                        tagIds = device.tags.map(t => t.id);
                    }
                }

                // Build update data
                const updateData: any = {
                    name,
                    status,
                    description,
                    updatedAt: new Date()
                };

                // Handle tags - set (replace all) instead of connect (add)
                if (tagIds.length > 0) {
                    updateData.tags = {
                        set: tagIds.map(tagId => ({ id: tagId }))
                    };
                } else {
                    // Clear all tags if empty array
                    updateData.tags = {
                        set: []
                    };
                }

                // Update device
                const updatedDevice = await locals.prisma.device.update({
                    where: { id },
                    data: updateData,
                    include: { tags: true }
                });

                logger.info(`Device ${id} updated successfully`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: device,
                    newData: updatedDevice,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });
                
                return { success: true };
            } catch (err) {
                logger.error(`Error updating device: ${err}`);
                return fail(500, { error: 'Failed to update device' });
            }
        },

        /**
         * Create device action (Admin only)
         * Only available when enableCreate is true
         */
        create: options.enableCreate ? async ({ request, locals }: { request: Request; locals: any }) => {
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
                if (!auth?.user) {
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

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Device',
                    recordId: device.id,
                    oldData: null,
                    newData: device,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
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
        } : undefined
    };
}

