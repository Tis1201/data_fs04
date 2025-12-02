import type { PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { deviceSchema } from '$lib/schemas/device';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { getStatusBeforeToggled } from '$lib/utils';
import { isDeviceOnline, areDevicesOnline } from '$lib/server/device/devicePresence';
import { getMultipleDeviceInformation } from '$lib/server/clickhouse/client';

// Define table options for Devices
const table_options = {
    modelName: 'device',
    searchableFields: ['name', 'id', 'hardwareId', 'macAddress', 'wifiMac', 'lanMac'],
    allowedFilters: ['types', 'statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'types': { field: 'deviceType', operator: 'in' },
        'statuses': { field: 'status', operator: 'in' }
    },
    // Add user-specific filter to only show user's devices
    additionalFilters: (locals: any) => {
        const userId = locals.auth?.user?.id;
        if (!userId) return {};
        
        return {
            OR: [
                { createdBy: userId }, // Devices created by this user
                { 
                    account: {
                        members: {
                            some: {
                                userId: userId
                            }
                        }
                    }
                } // Devices in accounts where user is a member
            ]
        };
    },
    // Include MAC address fields in the select
    select: {
        id: true,
        name: true,
        connected: true,
        deviceType: true,
        hardwareId: true,
        manufacturer: true,
        macAddress: true,
        wifiMac: true,
        lanMac: true,
        createdAt: true,
        osVersion: true,
        status: true,
        tags: {
            select: {
                id: true,
                name: true
            }
        }
    }
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }) => {
        // Add a dependency key for invalidation
        depends('app:userDevices');
        
        // Handle tags filtering manually (similar to admin implementation)
        let filteredTagIds = url.searchParams.get("tags");
        if (filteredTagIds) {
            filteredTagIds = filteredTagIds.includes(',') ? filteredTagIds.split(',').filter(Boolean) : [filteredTagIds];
            (table_options as any).baseWhere = {
                tags: {
                    some: {
                        id: {
                            in: filteredTagIds,
                        }
                    }
                }
            }
        } else {
            // Clear baseWhere if no tags filter
            delete (table_options as any).baseWhere;
        }
        
        // Use the reusable fetchTableData function with our table options
        const result = await fetchTableData(locals, url, table_options);
        
        // Fetch available tags for the filter
        const availableTags = await locals.prisma.deviceTag.findMany({
            select: {
                id: true,
                name: true
            },
            orderBy: {
                name: 'asc'
            }
        });
        
        // Update online status from Redis (real-time presence tracking via pushpin-tracker)
        const devicesWithRealTimeStatus = await Promise.all(
            result.records.map(async (device: any) => {
                const isOnline = await isDeviceOnline(device.id);
                return {
                    ...device,
                    connected: isOnline  // Override DB value with real-time Redis status
                };
            })
        );

        // Load device information from ClickHouse for all devices
        const macAddresses = devicesWithRealTimeStatus
            .map((d: any) => d.macAddress || d.lanMac || d.wifiMac)
            .filter(Boolean);
        const deviceInfoMap = await getMultipleDeviceInformation(macAddresses);
        
        // Get user's current account ID for account-level subscriptions
        const user = locals.auth?.user;
        const userAccountId = locals.currentAccount?.account?.id || 
                              locals.auth?.currentAccount?.account?.id || 
                              user?.primaryAccountId || 
                              null;
        
        // Fetch device statistics grouped by OS (for user's accessible devices)
        const userId = user?.id;
        const allDevices = await locals.prisma.device.findMany({
            where: {
                OR: [
                    { createdBy: userId }, // Devices created by this user
                    { 
                        account: {
                            members: {
                                some: {
                                    userId: userId
                                }
                            }
                        }
                    } // Devices in accounts where user is a member
                ]
            },
            select: {
                id: true,
                osVersion: true,
                deviceType: true
            }
        });

        // Batch check online status for all devices
        const deviceIds = allDevices.map((d: { id: string; osVersion: string | null; deviceType: string | null }) => d.id);
        const onlineStatusMap = await areDevicesOnline(deviceIds);

        // Initialize statistics counters
        const stats = {
            total: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 },
            online: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 },
            offline: { total: 0, android: 0, linux: 0, windows: 0, apple: 0 }
        };

        // Count devices by OS and online status
        for (const device of allDevices) {
            const isOnline = onlineStatusMap.get(device.id) || false;
            
            // Determine OS from osVersion field (deviceType is for device categories, not OS)
            const osVersion = (device.osVersion || '').toLowerCase().trim();
            
            // Map OS to our categories based on osVersion
            let category: 'android' | 'linux' | 'windows' | 'apple' | null = null;
            
            if (osVersion) {
                // Apple/macOS/iOS detection (check first to avoid "darwin" matching "win")
                if (osVersion.includes('darwin') || 
                    osVersion.includes('ios') || 
                    osVersion.includes('macos') || 
                    osVersion.includes('mac os') ||
                    osVersion.includes('apple')) {
                    category = 'apple';
                }
                // Android detection
                else if (osVersion.includes('android')) {
                    category = 'android';
                }
                // Linux detection (various distributions)
                else if (osVersion.includes('linux') || 
                         osVersion.includes('ubuntu') || 
                         osVersion.includes('debian') || 
                         osVersion.includes('centos') || 
                         osVersion.includes('redhat') ||
                         osVersion.includes('rhel') ||
                         osVersion.includes('fedora') ||
                         osVersion.includes('arch') ||
                         osVersion.includes('suse')) {
                    category = 'linux';
                }
                // Windows detection (more specific to avoid matching "darwin")
                else if (osVersion.includes('windows') || 
                         (osVersion.includes('win') && !osVersion.includes('darwin')) ||
                         osVersion.includes('nt ')) {
                    category = 'windows';
                }
            }

            // Always count in total
            stats.total.total++;
            
            if (category) {
                stats.total[category]++;

                if (isOnline) {
                    stats.online.total++;
                    stats.online[category]++;
                } else {
                    stats.offline.total++;
                    stats.offline[category]++;
                }
            } else {
                // Count devices with unknown/missing OS in total only
                if (isOnline) {
                    stats.online.total++;
                } else {
                    stats.offline.total++;
                }
            }
        }
        
        return {
            devices: devicesWithRealTimeStatus,
            deviceInformation: Object.fromEntries(deviceInfoMap), // Convert Map to object for serialization
            meta: result.meta,
            availableTags,
            userRole: user?.systemRole || 'MEMBER',
            accountId: userAccountId,
            deviceStats: stats
        };
    },
    [SystemRole.USER] // Restrict to authenticated users
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
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
                
                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }
                
                // Check if device exists and belongs to the user
                const device = await locals.prisma.device.findFirst({
                    where: { 
                        id,
                        OR: [
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
                        ]
                    }
                });
                
                if (!device) {
                    return fail(404, { error: 'Device not found or you do not have permission to modify it' });
                }
                
                // Update the device status
                await locals.prisma.device.update({
                    where: { id },
                    data: { 
                        status,
                        updatedAt: new Date() 
                    }
                });

                logger.info(`User ${auth.user.id} changed device ${id} status to ${status}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Device',
                    recordId: id,
                    oldData: getStatusBeforeToggled(status),
                    newData: { status },
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling device status: ${err}`);
                return fail(500, { error: 'Failed to update device status' });
            }
        },
        [SystemRole.USER] // Restrict to authenticated users
    ),
    /*******************************************************************************************
     * Delete Device
     ******************************************************************************************/
    delete: restrict(
        async ({ request, locals }) => {
            try {
                const data = await request.formData();
                const id = data.get('id')?.toString();
                if (!id) {
                    return fail(400, { error: 'Device ID is required' });
                }

                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Fetch device first
                const device = await locals.prisma.device.findUnique({ where: { id } });

                if (!device) {
                    return fail(404, { error: 'Device not found' });
                }

                // Authorization:
                // - Allow if current user is the creator (Option B in schema)
                // - Or allow if device has an account and user is OWNER/ADMIN of that account
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

                await locals.prisma.device.delete({ where: { id } });

                logger.info(`User ${auth.user.id} deleted device ${id}`);

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

                return { success: true };
            } catch (err) {
                logger.error(`Error deleting device: ${err}`);
                return fail(500, { error: 'Failed to delete device' });
            }
        },
        [SystemRole.USER]
    )
} satisfies Actions;
