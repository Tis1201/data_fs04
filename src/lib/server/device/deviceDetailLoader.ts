import { error } from '@sveltejs/kit';
import type { PrismaClient } from '@prisma/client';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import type { z } from 'zod';
import { logger } from '$lib/server/logger';
import { getLatestDeviceInformationByDeviceId } from '$lib/server/clickhouse/client';
import { isDeviceOnline } from '$lib/server/device/devicePresence';
import { loadDeviceProfileWithForm } from '$lib/server/device/deviceProfileLoader';

export interface DeviceDetailLoadOptions {
    /**
     * Whether to check device ownership for non-admin users
     * If true, will verify user owns device or has account access
     */
    checkOwnership?: boolean;
    /**
     * User ID for ownership check
     */
    userId?: string;
    /**
     * Account ID for ownership check
     */
    accountId?: string;
    /**
     * Whether to use verbose logging (for admin routes)
     */
    verboseLogging?: boolean;
}

/**
 * Shared loader function for device detail pages
 * Used by both admin and user routes
 */
export async function loadDeviceDetail(
    prisma: PrismaClient,
    deviceId: string,
    deviceEditSchema: z.ZodType<any>,
    options: DeviceDetailLoadOptions = {}
): Promise<{
    form: any;
    device: any;
    deviceActionLogs: any[];
    deviceInformation: any;
    deviceProfile: any;
    deviceProfileForm: any;
    availableTags: Array<{ id: string; name: string }>;
    availableProfiles: Array<{ id: string; name: string; description?: string }>;
}> {
    const { checkOwnership = false, userId, accountId, verboseLogging = false } = options;

    if (verboseLogging) {
        logger.info('[DeviceDetail] ========== LOAD START ==========');
        logger.info('[DeviceDetail] Device ID', { deviceId });
    }

    try {
        if (verboseLogging) {
            logger.info('[DeviceDetail] Step 1: Loading device from database...', { deviceId } as Record<string, any>);
        }

        // Build device query with optional ownership check
        const deviceWhere: any = { id: deviceId };
        
        if (checkOwnership && userId) {
            // For user routes, check ownership
            deviceWhere.OR = [
                { createdBy: userId },
                ...(accountId ? [{ accountId }] : [])
            ];
        }

        // Load existing device
        const device = await prisma.device.findFirst({
            where: deviceWhere,
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

        if (verboseLogging) {
            logger.info('[DeviceDetail] Step 1 COMPLETE - Device query result:', {
                found: !!device,
                deviceId: device?.id,
                deviceName: device?.name,
                hasUser: !!device?.user,
                hasAccount: !!device?.account,
                licenseCount: device?.licenses?.length || 0
            });
        }

        if (!device) {
            if (verboseLogging) {
                logger.warn('[DeviceDetail] Device not found', { deviceId });
            }
            throw error(404, "Device not found");
        }

        if (verboseLogging) {
            logger.info('[DeviceDetail] Step 2: Creating form validation...');
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
                macAddress: device.macAddress || "",
                wifiMac: device.wifiMac || "",
                lanMac: device.lanMac || "",
                ipAddress: device.ipAddress || "",
                apiKey: device.apiKey || "",
            },
            zod(deviceEditSchema)
        );

        if (verboseLogging) {
            logger.info('[DeviceDetail] Step 2 COMPLETE - Form validated');
            logger.info('[DeviceDetail] Step 3: Fetching device action logs...');
        }

        // Fetch recent device action logs (last 50)
        const deviceActionLogs = await prisma.deviceActionLog.findMany({
            where: { deviceId },
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

        // Fetch device information from ClickHouse by device_id only (optional - may not be configured)
        let deviceInformation = null;
        try {
            deviceInformation = await getLatestDeviceInformationByDeviceId(deviceId);
        } catch (clickhouseError) {
            // ClickHouse may not be configured - this is optional data
            logger.warn('[DeviceDetail] ClickHouse query failed (optional)', { 
                error: clickhouseError instanceof Error ? clickhouseError.message : String(clickhouseError)
            });
        }

        // Check real-time online status from pushpin-tracker (Redis)
        // This is more accurate than the database 'connected' field
        let isOnline = device.connected || false;
        try {
            isOnline = await isDeviceOnline(device.id);
        } catch (redisError) {
            // Redis may not be available - fall back to database value
            logger.warn('[DeviceDetail] Redis online check failed, using DB value', {
                error: redisError instanceof Error ? redisError.message : String(redisError)
            });
        }
        
        if (verboseLogging) {
            logger.info('[DeviceDetail] Real-time online status', { deviceId: device.id, isOnline } as Record<string, any>);
        }

        // Load device profile using shared utility
        const { deviceProfile, deviceProfileForm } = await loadDeviceProfileWithForm(
            prisma,
            deviceId
        );

        // Fetch available tags for the Edit Device modal
        let availableTags: Array<{ id: string; name: string }> = [];
        try {
            availableTags = await prisma.deviceTag.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
        } catch (err) {
            logger.warn(`[DeviceDetail] Failed to load available tags: ${err}`);
            // Continue with empty tags array - page can still load
            availableTags = [];
        }

        // Fetch available device profiles for the Edit Device modal
        let availableProfiles: Array<{ id: string; name: string; description?: string }> = [];
        try {
            // Get user's account memberships for filtering if ownership check is enabled
            let accountIds: string[] = [];
            if (checkOwnership && userId) {
                const userAccountMemberships = await prisma.accountMembership.findMany({
                    where: { userId },
                    select: { accountId: true }
                });
                accountIds = userAccountMemberships.map((m: { accountId: string }) => m.accountId);
            }

            const profileWhere: any = { isActive: true };
            if (checkOwnership && accountIds.length > 0) {
                profileWhere.accountId = { in: accountIds };
            }

            availableProfiles = await prisma.deviceProfile.findMany({
                where: profileWhere,
                select: {
                    id: true,
                    name: true,
                    description: true
                },
                orderBy: {
                    name: 'asc'
                }
            });
        } catch (err) {
            logger.warn(`[DeviceDetail] Failed to load available profiles: ${err}`);
            // Continue with empty profiles array - page can still load
            availableProfiles = [];
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
            deviceProfileForm,
            availableTags,
            availableProfiles
        };
    } catch (e) {
        if (verboseLogging) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const errorStack = e instanceof Error ? e.stack : undefined;
            const errorName = e instanceof Error ? e.constructor.name : 'Unknown';
            
            logger.error('[DeviceDetail] ========== LOAD ERROR ==========');
            logger.error('[DeviceDetail] Error details:', {
                deviceId,
                errorType: errorName,
                errorMessage,
                stack: errorStack
            });
            
            // Log the full error object for debugging
            if (e instanceof Error && e.cause) {
                logger.error('[DeviceDetail] Error cause', { cause: e.cause } as Record<string, any>);
            }
        } else {
            logger.error('Error loading device', { error: e });
        }

        // Re-throw SvelteKit errors as-is
        if (e && typeof e === 'object' && 'status' in e) {
            throw e;
        }

        const errorMessage = e instanceof Error ? e.message : String(e);
        throw error(500, `Failed to load device: ${errorMessage}`);
    }
}

