import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrictModule } from '$lib/server/security/guards';
import type { ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { ProfileConfigBuilder } from '$lib/server/device/profile';

/**
 * GET /user/iot/devices/[id]
 * Get device details as JSON
 * Used by Edit Device modal to fetch full device data
 */
export const GET: RequestHandler = restrictModule(
    async ({ params, locals }: ModuleAuthenticatedEvent) => {
        const deviceId = params.id;
        
        if (!deviceId) {
            throw error(400, 'Device ID is required');
        }

        try {
            // restrictModule sets locals.auth to the session (no .validate); when skipCheck it doesn't set locals.user.
            // Use session from locals.auth when it has .user; otherwise validate (guard passed Lucia auth in locals).
            let userId: string | undefined = (locals as any).user?.id;
            if (!userId) {
                const auth = (locals as any).auth?.user
                    ? (locals as any).auth
                    : await (locals as any).auth?.validate?.();
                userId = auth?.user?.id;
            }
            if (!userId) {
                throw error(401, 'Unauthorized');
            }

            // Check if device exists and user has permission
            const deviceWhere: any = { id: deviceId };
            
            // Ownership check for user routes
            deviceWhere.OR = [
                { createdBy: userId },
                {
                    account: {
                        members: {
                            some: {
                                userId
                            }
                        }
                    }
                }
            ];

            const device = await locals.prisma.device.findFirst({
                where: deviceWhere,
                include: {
                    tags: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    profileAssignment: {
                        include: {
                            profile: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });
            
            if (!device) {
                throw error(404, 'Device not found or you do not have permission to view it');
            }

            // Get profileId from DeviceProfileAssignment table
            // DeviceProfileAssignment has unique constraint on deviceId, so each device has at most one assignment
            const assignment = await locals.prisma.deviceProfileAssignment.findUnique({
                where: { deviceId: device.id },
                include: {
                    profile: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });
            
            const profileId = assignment?.profileId || null;
            logger.info(`[API] Device ${device.id} - DeviceProfileAssignment:`, {
                found: !!assignment,
                profileId: assignment?.profileId,
                profileName: assignment?.profile?.name
            });
            console.log('[API] DeviceProfileAssignment:', assignment);
            console.log('[API] Extracted profileId:', profileId);

            // Build effective config from profile and overrides
            const configBuilder = new ProfileConfigBuilder(locals.prisma);
            let effectiveConfig: Record<string, any> = {};
            let hasOverrides = false;
            try {
                const { config, metadata } = await configBuilder.buildEffectiveConfig(device.id);
                // Convert config to simple key-value pairs
                effectiveConfig = Object.entries(config).reduce((acc, [key, setting]) => {
                    acc[key] = setting.value;
                    return acc;
                }, {} as Record<string, any>);
                hasOverrides = metadata.hasOverrides || false;
                const scheduleKeys = [
                    'power_management_schedule', 'power_on_datetime', 'power_off_datetime',
                    'reboot_schedule_enabled', 'reboot_schedule_frequency', 'reboot_schedule_day', 'reboot_schedule_time',
                    'download_schedule_enabled', 'download_schedule_frequency', 'download_schedule_day', 'download_schedule_time'
                ];
                logger.info(`[API] Device ${device.id} - Effective config built`, {
                    profileId: metadata.profileId,
                    hasOverrides: metadata.hasOverrides,
                    overrideCount: metadata.overrideCount,
                    allConfigKeys: Object.keys(effectiveConfig),
                    scheduleValues: Object.fromEntries(
                        scheduleKeys.filter(k => k in effectiveConfig).map(k => [k, effectiveConfig[k]])
                    )
                });
            } catch (configError) {
                logger.warn(`Failed to build effective config for device ${device.id}: ${configError}`);
                // Continue with empty config - device might not have profile assignment
            }

            // Convert Prisma device to plain object with effective config
            const deviceData = {
                id: device.id,
                name: device.name,
                description: device.description,
                status: device.status,
                deviceType: device.deviceType,
                osVersion: device.osVersion,
                profileId: profileId,
                hasCustomOverrides: hasOverrides, // Flag to indicate if device has custom overrides
                // Map config keys from snake_case to camelCase
                kioskLockMode: effectiveConfig.kiosk_lock_mode ?? effectiveConfig.kioskLockMode ?? false,
                exitLockdownPassword: effectiveConfig.exit_lockdown_password ?? effectiveConfig.exitLockdownPassword ?? null,
                kioskApplication: effectiveConfig.kiosk_application ?? effectiveConfig.kioskApplication ?? null,
                displayResolution: effectiveConfig.display_resolution ?? effectiveConfig.displayResolution ?? null,
                screenOrientation: effectiveConfig.screen_orientation ?? effectiveConfig.screenOrientation ?? null,
                brightnessLevel: effectiveConfig.brightness_level ?? effectiveConfig.brightnessLevel ?? null,
                audioEnabled: effectiveConfig.enable_audio ?? effectiveConfig.audioEnabled ?? effectiveConfig.enableAudio ?? null,
                audioVolume: effectiveConfig.volume_level ?? effectiveConfig.audioVolume ?? effectiveConfig.volumeLevel ?? null,
                timezone: effectiveConfig.timezone ?? null,
                homeLauncher: effectiveConfig.home_launcher ?? effectiveConfig.homeLauncher ?? null,
                powerManagementSchedule: (effectiveConfig.power_management_schedule ?? effectiveConfig.powerManagementSchedule) === 'enabled',
                powerOnDatetime: effectiveConfig.power_on_datetime ?? effectiveConfig.powerOnDatetime ?? '',
                powerOffDatetime: effectiveConfig.power_off_datetime ?? effectiveConfig.powerOffDatetime ?? '',
                rebootSchedule: (effectiveConfig.reboot_schedule_enabled ?? effectiveConfig.rebootSchedule) === 'enabled',
                rebootFrequency: effectiveConfig.reboot_schedule_frequency ?? effectiveConfig.rebootFrequency ?? 'daily',
                rebootDay: effectiveConfig.reboot_schedule_day ?? effectiveConfig.rebootDay ?? 'monday',
                rebootTime: effectiveConfig.reboot_schedule_time ?? effectiveConfig.rebootTime ?? '02:00',
                downloadSchedule: (effectiveConfig.download_schedule_enabled ?? effectiveConfig.downloadSchedule) === 'enabled',
                downloadFrequency: effectiveConfig.download_schedule_frequency ?? effectiveConfig.downloadFrequency ?? 'daily',
                downloadDay: effectiveConfig.download_schedule_day ?? effectiveConfig.downloadDay ?? 'monday',
                downloadTime: effectiveConfig.download_schedule_time ?? effectiveConfig.downloadTime ?? '03:00',
                tags: device.tags || []
            };

            return json({ success: true, device: deviceData });
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            logger.error(`Error fetching device details ${deviceId}:`, { message: err.message, stack: err.stack });
            if (e && typeof e === 'object' && 'status' in e) {
                throw e;
            }
            throw error(500, 'Failed to fetch device details');
        }
    },
    'USER_DEVICES',
    { action: 'VIEW', skipCheck: true } // TODO: Re-enable ACL when module permissions are configured
) satisfies RequestHandler;
