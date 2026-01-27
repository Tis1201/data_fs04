import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { getStatusBeforeToggled } from '$lib/utils';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { deviceSchema } from '$lib/schemas/device';
import { DeviceProfileService } from '$lib/server/device/profile';

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
    getDeviceDetails: (args: { request: Request; locals: any }) => Promise<any>;
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
                    oldData: { tags: device.tags.map((t: any) => t.id) },
                    newData: { tags: [...device.tags.map((t: any) => t.id), ...tagIds] },
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
         * Get device details action
         * Used by both list pages (admin and user) for Edit Device modal
         */
        getDeviceDetails: async ({ request, locals }: { request: Request; locals: any }) => {
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
                    include: {
                        tags: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                    // Note: When using include, Prisma automatically includes all scalar fields
                    // So profileId and all config fields (kioskLockMode, displayResolution, etc.) 
                    // will be automatically included in the result
                });
                
                if (!device) {
                    return fail(404, { 
                        error: options.checkOwnership 
                            ? 'Device not found or you do not have permission to view it'
                            : 'Device not found'
                    });
                }

                // Convert Prisma device to plain object to avoid serialization issues
                // SvelteKit actions serialize data, so we need to ensure it's a plain object
                const deviceData = {
                    id: device.id,
                    name: device.name,
                    description: device.description,
                    status: device.status,
                    deviceType: device.deviceType,
                    osVersion: device.osVersion,
                    profileId: device.profileId,
                    kioskLockMode: device.kioskLockMode,
                    exitLockdownPassword: device.exitLockdownPassword,
                    kioskApplication: device.kioskApplication,
                    displayResolution: device.displayResolution,
                    screenOrientation: device.screenOrientation,
                    brightnessLevel: device.brightnessLevel,
                    audioEnabled: device.audioEnabled,
                    audioVolume: device.audioVolume,
                    timezone: device.timezone,
                    homeLauncher: device.homeLauncher,
                    powerManagementSchedule: device.powerManagementSchedule,
                    rebootSchedule: device.rebootSchedule,
                    downloadSchedule: device.downloadSchedule,
                    tags: device.tags || []
                };

                return { success: true, device: deviceData };
            } catch (err) {
                logger.error(`Error fetching device details: ${err}`);
                return fail(500, { error: 'Failed to fetch device details' });
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

                // Extract form data - Details tab
                // Always use form data if provided (form data takes precedence)
                const nameValue = data.get('name')?.toString();
                const statusValue = data.get('status')?.toString();
                const descriptionValue = data.get('description')?.toString();
                
                // Use form values if provided, otherwise keep device values
                // For name: form value takes precedence, fallback to device.name
                const name = (nameValue !== null && nameValue !== undefined) ? nameValue : (device.name || '');
                // For status: form value takes precedence, must be valid, fallback to device.status
                const status = (statusValue && ['ACTIVE', 'INACTIVE'].includes(statusValue)) ? statusValue : device.status;
                // For description: form value takes precedence (even if empty string), fallback to device.description or empty string
                const description = (descriptionValue !== null && descriptionValue !== undefined) 
                    ? descriptionValue 
                    : (device.description !== null && device.description !== undefined ? device.description : '');
                
                // Parse tags - always parse if provided
                let tagIds: string[] = [];
                const tagsRaw = data.get('tags')?.toString();
                if (tagsRaw !== null && tagsRaw !== undefined) {
                    try {
                        const parsed = JSON.parse(tagsRaw);
                        tagIds = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                        logger.warn(`Failed to parse tags JSON: ${tagsRaw}`, e);
                        // If parsing fails, use empty array (user wants to clear tags)
                        tagIds = [];
                    }
                } else {
                    // If tags not provided in form, keep existing tags
                    tagIds = device.tags.map((t: any) => t.id);
                }

                // Extract Configuration tab fields
                const profileId = data.get('profileId')?.toString();
                const isCustom = data.get('isCustom')?.toString() === 'true';
                const kioskLockMode = data.get('kioskLockMode')?.toString() === 'true';
                const exitLockdownPassword = data.get('exitLockdownPassword')?.toString();
                const kioskApplication = data.get('kioskApplication')?.toString();
                const displayResolution = data.get('displayResolution')?.toString();
                const screenOrientation = data.get('screenOrientation')?.toString();
                const brightnessLevel = data.get('brightnessLevel')?.toString();
                const audioEnabled = data.get('audioEnabled')?.toString() === 'true';
                const audioVolume = data.get('audioVolume')?.toString();
                const timezone = data.get('timezone')?.toString();
                const homeLauncher = data.get('homeLauncher')?.toString();
                const powerManagementSchedule = data.get('powerManagementSchedule')?.toString() === 'true';
                const rebootSchedule = data.get('rebootSchedule')?.toString() === 'true';
                const downloadSchedule = data.get('downloadSchedule')?.toString() === 'true';

                // Build update data - Details tab fields (always update these)
                const updateData: any = {
                    name,
                    status,
                    description,
                    updatedAt: new Date()
                };

                // Handle Configuration tab fields
                if (isCustom) {
                    // Custom mode: Save as device-specific overrides using DeviceProfileService
                    // First, ensure device has a profile assigned (required for overrides)
                    const currentAssignment = await locals.prisma.deviceProfileAssignment.findUnique({
                        where: { deviceId: id }
                    });
                    
                    if (!currentAssignment) {
                        // Custom mode requires a base profile to override
                        // If no assignment exists, we need to get the original profileId from device
                        // or use the profileId from form if provided (user might have selected a profile before editing)
                        let baseProfileId = profileId && profileId !== '__CUSTOM__' ? profileId : null;
                        
                        // If still no profileId, try to get from device's previous assignment or use first available profile
                        if (!baseProfileId) {
                            // Get device to check if it had a profile before
                            const deviceWithAssignment = await locals.prisma.device.findUnique({
                                where: { id },
                                include: {
                                    profileAssignment: true
                                }
                            });
                            baseProfileId = deviceWithAssignment?.profileAssignment?.profileId || null;
                        }
                        
                        if (!baseProfileId) {
                            // Cannot save custom overrides without a base profile
                            return fail(400, { 
                                error: 'Cannot save custom settings without a base profile. Please select a profile first.' 
                            });
                        }
                        
                        // Create assignment with the base profile
                        await locals.prisma.deviceProfileAssignment.create({
                            data: {
                                deviceId: id,
                                profileId: baseProfileId,
                                assignedBy: auth.user.id
                            }
                        });
                        logger.info(`Created profile assignment ${baseProfileId} for device ${id} before saving custom overrides`);
                    }
                    
                    // Build settings object in snake_case format (as expected by profile system)
                    const customSettings: Record<string, any> = {};
                    if (data.has('kioskLockMode')) {
                        customSettings.kiosk_lock_mode = kioskLockMode ? 'enabled' : 'disabled';
                    }
                    if (exitLockdownPassword !== null && exitLockdownPassword !== undefined) {
                        customSettings.exit_lockdown_password = exitLockdownPassword || '';
                    }
                    if (kioskApplication !== null && kioskApplication !== undefined) {
                        customSettings.kiosk_application = kioskApplication || '';
                    }
                    if (displayResolution !== null && displayResolution !== undefined) {
                        customSettings.display_resolution = displayResolution || '';
                    }
                    if (screenOrientation !== null && screenOrientation !== undefined) {
                        customSettings.screen_orientation = screenOrientation || '';
                    }
                    if (brightnessLevel !== null && brightnessLevel !== undefined) {
                        customSettings.brightness_level = brightnessLevel || '';
                    }
                    if (data.has('audioEnabled')) {
                        customSettings.enable_audio = audioEnabled ? 'enabled' : 'disabled';
                    }
                    if (audioVolume !== null && audioVolume !== undefined) {
                        customSettings.volume_level = audioVolume || '';
                    }
                    if (timezone !== null && timezone !== undefined) {
                        customSettings.timezone = timezone || '';
                    }
                    if (homeLauncher !== null && homeLauncher !== undefined) {
                        customSettings.home_launcher = homeLauncher || '';
                    }
                    if (data.has('powerManagementSchedule')) {
                        customSettings.power_management_schedule = powerManagementSchedule ? 'enabled' : 'disabled';
                    }
                    if (data.has('rebootSchedule')) {
                        customSettings.reboot_schedule_enabled = rebootSchedule ? 'enabled' : 'disabled';
                    }
                    if (data.has('downloadSchedule')) {
                        customSettings.download_schedule_enabled = downloadSchedule ? 'enabled' : 'disabled';
                    }
                    
                    // Save custom overrides using DeviceProfileService
                    if (Object.keys(customSettings).length > 0) {
                        const profileService = new DeviceProfileService(locals.prisma);
                        const userId = auth.user.id;
                        await profileService.updateDeviceSettings(id, customSettings, userId);
                        logger.info(`Saved custom overrides for device ${id}`);
                    }
                } else if (profileId && profileId !== '__CUSTOM__') {
                    // Profile mode: Assign profile to device
                    // Remove any existing assignment first
                    await locals.prisma.deviceProfileAssignment.deleteMany({
                        where: { deviceId: id }
                    });
                    
                    // Create new assignment
                    await locals.prisma.deviceProfileAssignment.create({
                        data: {
                            deviceId: id,
                            profileId: profileId,
                            assignedBy: auth.user.id
                        }
                    });
                    
                    // Remove any custom overrides (device now uses profile defaults)
                    await locals.prisma.deviceProfileOverride.deleteMany({
                        where: { deviceId: id }
                    });
                    
                    logger.info(`Assigned profile ${profileId} to device ${id} by user ${auth.user.id}`);
                }

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

                // Log audit - use auth.user.id
                try {
                    await logAudit({
                        actionType: AuditActionType.UPDATE,
                        tableName: 'Device',
                        recordId: id,
                        oldData: device,
                        newData: updatedDevice,
                        userId: auth.user.id,
                        ipAddress: locals.ipAddress || request.headers.get('x-forwarded-for') || 'unknown',
                        prisma: locals.prisma
                    });
                } catch (auditErr) {
                    // Don't fail the update if audit logging fails
                    logger.warn(`Failed to log audit for device update ${id}: ${auditErr}`);
                }
                
                return { success: true };
            } catch (err) {
                logger.error(`Error updating device ${id}:`, err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                logger.error(`Error details:`, {
                    error: errorMessage,
                    stack: err instanceof Error ? err.stack : undefined,
                    deviceId: id
                });
                return fail(500, { error: `Failed to update device: ${errorMessage}` });
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

