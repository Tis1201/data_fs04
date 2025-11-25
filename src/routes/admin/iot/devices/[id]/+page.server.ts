import { error, fail, json } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { deviceEditSchema } from './schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory, SystemUser } from '$lib/server/messaging/interfaces/message';
import { v4 as uuidv4 } from 'uuid';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { getLatestDeviceInformation } from '$lib/server/clickhouse/client';
import { isDeviceOnline } from '$lib/server/device/devicePresence';
import crypto from 'crypto';
import { z } from 'zod';

export const load = restrict(
    async ({ params, locals, depends }) => {
        console.log('[DeviceDetail] ========== LOAD START ==========');
        console.log('[DeviceDetail] Device ID:', params.id);
        console.log('[DeviceDetail] User:', { 
            userId: locals.user?.id, 
            systemRole: locals.user?.systemRole,
            email: locals.user?.email 
        });
        
        depends('app:device');
        
        try {
            console.log('[DeviceDetail] Step 1: Loading device from database...');
            
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
                    macAddress: true,
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
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    accountId: true,
                    account: {
                        select: {
                            id: true,
                            name: true,
                            slug: true
                        }
                    },
                    licenses: {
                        select: {
                            id: true,
                            status: true,
                            issuedAt: true,
                            expiresAt: true,
                            keyId: true,
                            algorithm: true
                        }
                    }
                }
            });

            console.log('[DeviceDetail] Step 1 COMPLETE - Device query result:', {
                found: !!device,
                deviceId: device?.id,
                deviceName: device?.name,
                hasUser: !!device?.user,
                hasAccount: !!device?.account,
                licenseCount: device?.licenses?.length || 0
            });

            if (!device) {
                console.warn('[DeviceDetail] Device not found:', params.id);
                throw error(404, "Device not found");
            }

            console.log('[DeviceDetail] Step 2: Creating form validation...');
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
                    macAddress: device.macAddress || "",
                    wifiMac: device.wifiMac || "",
                    lanMac: device.lanMac || "",
                    ipAddress: device.ipAddress || "",
                    apiKey: device.apiKey || "",
                },
                zod(deviceEditSchema)
            );
            console.log('[DeviceDetail] Step 2 COMPLETE - Form validated');

            console.log('[DeviceDetail] Step 3: Fetching device action logs...');
            // Fetch recent device action logs (last 50)
            const deviceActionLogs = await locals.prisma.deviceActionLog.findMany({
                where: { deviceId: params.id },
                orderBy: { initiatedAt: 'desc' },
                take: 50,
                select: {
                    id: true,
                    actionType: true,
                    status: true,
                    initiatedBy: true,
                    initiatedAt: true,
                    completedAt: true,
                    durationMs: true,
                    progress: true,
                    message: true,
                    error: true,
                    requestId: true,
                    protocol: true
                }
            });

            const deviceInformation = await getLatestDeviceInformation(device.macAddress);

            // Check real-time online status from pushpin-tracker (Redis)
            // This is more accurate than the database 'connected' field
            const isOnline = await isDeviceOnline(device.id);
            console.log('[DeviceDetail] Real-time online status:', { deviceId: device.id, isOnline });

            // Load device-level profile (if exists) or fallback to global profile from assignment
            let deviceProfile = null;
            try {
                // First, try to get device-level profile
                // @ts-ignore - deviceId will be available after schema migration
                const deviceLevelProfile = await locals.prisma.deviceProfile.findFirst({
                    where: {
                        // @ts-ignore - deviceId will be available after schema migration
                        deviceId: params.id,
                        level: 'DEVICE'
                    },
                    include: {
                        settings: {
                            orderBy: { order: 'asc' }
                        },
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });

                if (deviceLevelProfile) {
                    deviceProfile = deviceLevelProfile;
                } else {
                    // Fallback to global profile from assignment
                    const assignment = await locals.prisma.deviceProfileAssignment.findUnique({
                        where: { deviceId: params.id },
                        include: {
                            profile: {
                                include: {
                                    settings: {
                                        orderBy: { order: 'asc' }
                                    },
                                    account: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    });

                    if (assignment?.profile) {
                        deviceProfile = assignment.profile;
                    }
                }
            } catch (profileError) {
                console.error('[DeviceDetail] Error loading device profile:', profileError);
                // Continue without profile if there's an error
            }

            // Initialize form for device profile editing (if device-level profile exists)
            let deviceProfileForm = null;
            console.log('[DeviceDetail] Device profile check:', {
                hasProfile: !!deviceProfile,
                level: deviceProfile?.level,
                profileId: deviceProfile?.id,
                settingsCount: deviceProfile?.settings?.length
            });
            
            if (deviceProfile && deviceProfile.level === 'DEVICE') {
                console.log('[DeviceDetail] Creating form for DEVICE-level profile');
                const profileSchema = z.object({
                    name: z.string().min(1).max(100),
                    description: z.string().max(500).optional(),
                    settings: z.string().optional().default('[]')
                });
                
                try {
                    deviceProfileForm = await superValidate({
                        name: deviceProfile.name,
                        description: deviceProfile.description || '',
                        settings: JSON.stringify(deviceProfile.settings || [])
                    }, zod(profileSchema));
                    console.log('[DeviceDetail] Device profile form created successfully');
                } catch (formError) {
                    console.error('[DeviceDetail] Error creating device profile form:', formError);
                }
            } else {
                console.log('[DeviceDetail] Not creating form - profile is GLOBAL or missing');
            }

            return {
                form,
                device: {
                    ...device,
                    connected: isOnline  // Override database value with real-time status
                },
                deviceActionLogs,
                deviceInformation,
                deviceProfile,
                deviceProfileForm
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const errorStack = e instanceof Error ? e.stack : undefined;
            const errorName = e instanceof Error ? e.constructor.name : 'Unknown';
            
            console.error('[DeviceDetail] ========== LOAD ERROR ==========');
            console.error('[DeviceDetail] Error details:', {
                deviceId: params.id,
                errorType: errorName,
                errorMessage: errorMessage,
                stack: errorStack
            });
            
            // Log the full error object for debugging
            if (e instanceof Error && e.cause) {
                console.error('[DeviceDetail] Error cause:', e.cause);
            }
            
            throw error(500, `Failed to load device: ${errorMessage}`);
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
                        macAddress: form.data.macAddress || null,
                        wifiMac: form.data.wifiMac || null,
                        lanMac: form.data.lanMac || null,
                        ipAddress: form.data.ipAddress || null,
                    };

                    // Update device
                    const updatedDevice = await tx.device.update({
                        where: { id },
                        data: updateData
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

            const auth:any = await locals.auth.validate();
            const senderInfo = auth.user;

            logger.debug(`Generating new API key for device: ${JSON.stringify(senderInfo)}`);

            const id = params.id;

            try {
                // Check if device exists
                const device = await locals.prisma.device.findUnique({
                    where: { id }
                });

                if (!device) {
                    return fail(404, {
                        error: 'Device not found'
                    });
                }

                // Check if device is online before allowing rotation
                const deviceOnline = await isDeviceOnline(id);
                if (!deviceOnline) {
                    return fail(400, {
                        error: 'Device must be online to rotate API key. Please ensure the device is connected.'
                    });
                }

                // Generate new API key
                const apiKey = crypto.randomBytes(32).toString('hex');

                logger.info(`Generating new API key for device ${id}`);

                // Update device with new API key in database
                const now = new Date();
                const updatedDevice = await locals.prisma.device.update({
                    where: { id },
                    data: {
                        apiKey,
                        apiKeyCreatedAt: device.apiKeyCreatedAt || now,
                        apiKeyRotatedAt: now,
                        updatedAt: now
                    }
                });

                // Log audit
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: { apiKey: device.apiKey, apiKeyRotatedAt: device.apiKeyRotatedAt },
                    newData: { apiKey: updatedDevice.apiKey, apiKeyRotatedAt: updatedDevice.apiKeyRotatedAt },
                    userId: senderInfo.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                // Send new API key to device using SystemUser for proper authorization
                const updateMessage = MessageFactory.createSystemMessage(
                    'device',
                    `subscription:device:${id}`,
                    {
                        action: 'updateApiKey',
                        apiKey: apiKey,
                        requestId: `req-${Math.random().toString(36).substring(2, 15)}`,
                        timestamp: new Date().toISOString()
                    },
                    SystemUser,
                    { echoToSender: false }
                );

                await publisher.publish(updateMessage);
                logger.info(`Sent new API key to device ${id}`);

                // Create a minimal form for superForm response with required fields
                const form = await superValidate({ 
                    id, 
                    name: device.name || '', 
                    status: device.status || 'ACTIVE' 
                }, zod(deviceEditSchema));
                
                return message(form, {
                    success: true,
                    message: 'API key rotated successfully and sent to device',
                    apiKey
                });
            } catch (e) {
                logger.error(`Error generating API key: ${e}`);
                return fail(500, {
                    error: 'Failed to generate API key'
                });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    ),

    /**
     * Update device-level profile
     */
    updateDeviceProfile: restrict(
        async ({ params, request, locals }) => {
            const { id: deviceId } = params;
            const auth = await locals.auth.validate();
            
            if (!auth?.user) {
                return fail(401, { message: 'Unauthorized' });
            }

            // Check if device-level profile exists
            const deviceProfile = await locals.prisma.deviceProfile.findFirst({
                where: {
                    deviceId: deviceId,
                    level: 'DEVICE'
                },
                include: {
                    settings: true
                }
            });

            if (!deviceProfile) {
                return fail(404, { message: 'Device-level profile not found' });
            }

            // Validate form
            const profileSchema = z.object({
                name: z.string().min(1).max(100),
                description: z.string().max(500).optional(),
                settings: z.string().optional().default('[]')
            });

            const form = await superValidate(request, zod(profileSchema));
            
            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // Parse settings from JSON string
                let settingsArray = [];
                try {
                    settingsArray = JSON.parse(form.data.settings || '[]');
                } catch (e) {
                    console.error('Error parsing settings JSON:', e);
                    settingsArray = [];
                }

                // Update profile and settings in a transaction
                await locals.prisma.$transaction(async (tx) => {
                    // Update profile
                    await tx.deviceProfile.update({
                        where: { id: deviceProfile.id },
                        data: {
                            name: form.data.name,
                            description: form.data.description || null,
                            updatedBy: auth.user.id
                        }
                    });

                    // Delete existing settings
                    await tx.deviceProfileSetting.deleteMany({
                        where: { profileId: deviceProfile.id }
                    });

                    // Create new settings
                    if (settingsArray.length > 0) {
                        await tx.deviceProfileSetting.createMany({
                            data: settingsArray.map((setting: any, index: number) => ({
                                profileId: deviceProfile.id,
                                key: setting.key,
                                value: String(setting.value || ''),
                                dataType: setting.dataType,
                                label: setting.label,
                                category: setting.category || 'General',
                                order: setting.order !== undefined ? setting.order : index
                            }))
                        });
                    }
                });

                // Send updated profile to device
                try {
                    const updatedProfile = await locals.prisma.deviceProfile.findUnique({
                        where: { id: deviceProfile.id },
                        include: {
                            settings: true
                        }
                    });

                    if (updatedProfile) {
                        const { mapToConfigPayload } = await import('$lib/utils/mappers/deviceProfileMapper');
                        const config = mapToConfigPayload(updatedProfile as any);

                        // Send config update to device
                        const routingMessage = MessageFactory.createSystemMessage(
                            'device:actionRequest',
                            `subscription:device:${deviceId}`,
                            {
                                action: 'applyProfile',
                                deviceId: deviceId,
                                profileId: deviceProfile.id,
                                config: config,
                                sentAt: new Date().toISOString()
                            },
                            SystemUser,
                            { echoToSender: false }
                        );

                        await publisher.publish(routingMessage);
                    }
                } catch (sendError) {
                    logger.error(`Error sending profile update to device: ${String(sendError)}`);
                    // Don't fail the update if sending fails
                }

                return message(form, { 
                    success: true, 
                    text: 'Device profile updated successfully' 
                });

            } catch (error) {
                logger.error('Error updating device profile:', error);
                return fail(500, { 
                    form,
                    message: 'Failed to update device profile' 
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
