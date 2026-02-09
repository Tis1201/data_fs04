import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createDeviceTagTableOptions } from './deviceTagTableOptions';
import { areDevicesOnline } from '$lib/server/device/devicePresence';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';

/**
 * Load device tag list data
 * Per structural standard: load{Resource}List pattern
 */
export async function loadDeviceTagList(
    locals: any,
    url: URL,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
    }
) {
    try {
        // Get user's account memberships for filtering
        let accountIds: string[] = [];
        if (options?.checkOwnership && options?.userId) {
            const userAccountMemberships = await locals.prisma.accountMembership.findMany({
                where: { userId: options.userId },
                select: { accountId: true }
            });
            accountIds = userAccountMemberships.map((m: { accountId: string }) => m.accountId);
        }

        // Create table options with optional ownership filtering
        const tableOptions = options?.checkOwnership
            ? createDeviceTagTableOptions({
                checkOwnership: true,
                userId: options.userId,
                accountId: options.accountId
            })
            : createDeviceTagTableOptions(); // Admin can see all tags

        // Add account filtering to baseWhere if ownership check is enabled
        if (options?.checkOwnership && accountIds.length > 0) {
            tableOptions.baseWhere = {
                ...tableOptions.baseWhere,
                accountId: { in: accountIds }
            };
        }

        // Fetch table data with the appropriate options
        const result = await fetchTableData(locals, url, tableOptions);
        
        return {
            deviceTags: result.records,
            meta: result.meta
        };
    } catch (e) {
        logger.error(`Error loading device tags: ${JSON.stringify(e)}`);
        throw error(500, 'Failed to load device tags');
    }
}

/**
 * Load device tag detail data
 * Per structural standard: load{Resource}Detail pattern
 */
export async function loadDeviceTagDetail(
    locals: any,
    tagId: string,
    deviceTagSchema: any,
    options?: {
        checkOwnership?: boolean;
        userId?: string;
        accountId?: string;
    }
) {
    try {
        // Build where clause with optional ownership check
        const where: any = { id: tagId };
        
        if (options?.checkOwnership) {
            // Get user's account memberships
            let accountIds: string[] = [];
            if (options.userId) {
                const userAccountMemberships = await locals.prisma.accountMembership.findMany({
                    where: { userId: options.userId },
                    select: { accountId: true }
                });
                accountIds = userAccountMemberships.map((m: { accountId: string }) => m.accountId);
            }
            
            // Filter by account membership
            if (accountIds.length > 0) {
                where.accountId = { in: accountIds };
            } else {
                // User has no account memberships, can't access any tags
                throw error(404, 'Device tag not found');
            }
        }

        // Fetch the device tag
        const deviceTag = await locals.prisma.deviceTag.findFirst({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                updatedAt: true,
                devices: {
                    select: {
                        id: true,
                        name: true,
                        deviceType: true,
                        status: true,
                        connected: true,
                        model: true,
                        macAddress: true,
                        createdAt: true,
                        lastUsedAt: true
                    }
                },
                account: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!deviceTag) {
            throw error(404, 'Device tag not found');
        }

        // Override connected with real-time presence for devices
        let devicesWithPresence = deviceTag.devices || [];
        try {
            const presenceMap = await areDevicesOnline(devicesWithPresence.map((d: any) => d.id));
            devicesWithPresence = devicesWithPresence.map((d: any) => ({
                ...d,
                connected: presenceMap.get(d.id) ?? false
            }));
        } catch (presenceErr) {
            logger.warn(`[DeviceTags] Failed to enrich device presence: ${presenceErr instanceof Error ? presenceErr.message : String(presenceErr)}`);
        }

        // Create form data from existing tag
        const formData = {
            name: deviceTag.name,
            description: deviceTag.description || ''
        };

        const form = await superValidate(formData, zod(deviceTagSchema));

        return {
            form,
            deviceTag: {
                ...deviceTag,
                devices: devicesWithPresence
            }
        };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // Re-throw SvelteKit errors
        }
        logger.error(`Error loading device tag ${tagId}: ${err}`);
        throw error(500, 'Failed to load device tag');
    }
}

