import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';
import { loadDeviceList } from '$lib/server/devices/deviceLoader';
import { areDevicesOnline } from '$lib/server/device/devicePresence';
import { createDeviceActions } from '$lib/server/devices/deviceActions';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
// TODO: Re-enable after subscription system is implemented
// import { checkDeviceLimit, LimitExceededError } from '$lib/server/entitlements';
import { radarSensorSchema } from '../../../admin/controllers/radar/new/radar-sensor';
import type { Prisma } from '@prisma/client';
import prisma from '$lib/server/prisma';
import { getRadarSensorDisplayNameForDevice, resolveDeviceIdByPinForRadar } from '$lib/server/device/radarPinClaim';
import { buildRadarInitConfigFromDeviceProfile } from '$lib/server/device/radarAddDeviceProfileStep2';

/*******************************************************************************************
 * 
 *  Load Block - Combined data for Remote Devices and Sensors tabs
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, cookies, depends }: AuthenticatedLoadEvent) => {
        depends('app:allDevices');

        const userId = (locals as any).user?.id || (locals as any).auth?.user?.id;
        const accountId = (locals as any).currentAccount?.account?.id;
        const currentAccountId = cookies.get('current_account_id') || accountId;

        if (!currentAccountId) {
            throw error(403, 'User account not found');
        }

        // Get active tab from URL (default: 'remote-devices')
        const activeTab = url.searchParams.get('tab') || 'remote-devices';

        try {
            // Load Remote Devices data
            let devicesData = null;
            if (activeTab === 'remote-devices') {
                devicesData = await loadDeviceList(locals, url, {
                    checkOwnership: true,
                    userId,
                    accountId: currentAccountId,
                    // Include ClickHouse for Last ping (heartbeat) alignment with IoT devices page
                    includeDeviceInformation: true,
                    // Also skip expensive cross-device stats aggregation (not used on this page).
                    includeStats: false,
                    includeRealTimeStatus: true
                });
            }

            // Load Sensors data
            let sensorsData = null;
            if (activeTab === 'sensors') {
                const search = url.searchParams.get('search') || '';
                const page = parseInt(url.searchParams.get('page') || '1');
                const perPage = parseInt(url.searchParams.get('per_page') || '10');
                const sortField = url.searchParams.get('sort_field') || 'createdAt';
                const sortOrder = (url.searchParams.get('sort_order') || 'desc') as 'asc' | 'desc';
                const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
                const locations = url.searchParams.get('locations')?.split(',').filter(Boolean) || [];

                const skip = (page - 1) * perPage;
                const take = perPage;

                const where: {
                    type: string;
                    accountId: string;
                    OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
                    status?: { in: string[] };
                    location?: { in: string[] };
                } = {
                    type: 'radar',
                    accountId: currentAccountId
                };

                if (search) {
                    where.OR = [
                        { name: { contains: search, mode: 'insensitive' } },
                        { serialNumber: { contains: search, mode: 'insensitive' } },
                        { id: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                        { location: { contains: search, mode: 'insensitive' } }
                    ];
                }

                if (statuses.length > 0) {
                    where.status = { in: statuses };
                }

                if (locations.length > 0) {
                    where.location = { in: locations };
                }

                const baseWhere = {
                    type: 'radar' as const,
                    accountId: currentAccountId,
                    controller: { isDeleted: false }
                };

                const [sensors, totalSensors, locationRows] = await Promise.all([
                    locals.prisma.sensor.findMany({
                        where: {
                            ...where,
                            controller: { isDeleted: false }
                        },
                        orderBy: { [sortField]: sortOrder },
                        skip,
                        take,
                        select: {
                            id: true,
                            name: true,
                            serialNumber: true,
                            status: true,
                            description: true,
                            location: true,
                            firmware: true,
                            createdAt: true,
                            updatedAt: true,
                            accountId: true,
                            account: { select: { id: true, name: true } },
                            controller: {
                                select: {
                                    id: true,
                                    name: true,
                                    device: { select: { id: true, name: true } }
                                }
                            },
                            config: true
                        }
                    }),
                    locals.prisma.sensor.count({
                        where: { ...where, controller: { isDeleted: false } }
                    }),
                    locals.prisma.sensor.findMany({
                        where: baseWhere,
                        select: { location: true },
                        distinct: ['location']
                    })
                ]);

                const totalPages = Math.ceil(totalSensors / perPage);
                const availableLocations = (locationRows as { location: string | null }[])
                    .map((r) => r.location)
                    .filter((loc): loc is string => loc != null && loc.trim() !== '')
                    .sort((a, b) => a.localeCompare(b));

                // Enrich radar sensors with device connection status (Redis/MQTT presence) – batch lookup
                const sensorDeviceIds = sensors
                    .map((s: { controller?: { device?: { id: string } } }) => s.controller?.device?.id)
                    .filter((id): id is string => !!id);
                let sensorPresenceMap = new Map<string, boolean>();
                try {
                    sensorPresenceMap = await areDevicesOnline(sensorDeviceIds);
                } catch (e) {
                    logger.warn(`[Devices] Failed batch device presence check for sensors: ${e}`);
                }
                const radarSensorsEnriched = sensors.map((sensor: { controller?: { device?: { id: string } } }) => {
                    const deviceId = sensor.controller?.device?.id;
                    const connected = deviceId ? (sensorPresenceMap.get(deviceId) ?? false) : false;
                    return {
                        ...sensor,
                        controller: sensor.controller
                            ? {
                                ...sensor.controller,
                                device: sensor.controller.device
                                    ? { ...sensor.controller.device, connected }
                                    : undefined
                            }
                            : undefined
                    };
                });

                sensorsData = {
                    radarSensors: radarSensorsEnriched,
                    meta: {
                        totalItems: totalSensors,
                        itemsPerPage: perPage,
                        totalPages,
                        currentPage: page
                    },
                    sort: { field: sortField, order: sortOrder },
                    availableLocations
                };
            }

            // Get module permissions
            const user = (locals as any).user;
            const modulePermissions = user?.id 
                ? await getUserModulePermissions(user.id, currentAccountId)
                : {};

            return {
                activeTab,
                currentAccountId,
                // Remote Devices data
                ...(devicesData || {}),
                // Sensors data
                sensorsData,
                modulePermissions,
                user: user ? { id: user.id, systemRole: user.systemRole } : null
            };
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            logger.error(`Error loading all devices: ${errorMessage}`, {
                error: e,
                userId,
                accountId: currentAccountId,
                path: url.pathname
            });

            if (e && typeof e === 'object' && 'status' in e) {
                throw e;
            }

            throw error(500, `Failed to load devices: ${errorMessage}`);
        }
    },
    [SystemRole.USER, SystemRole.ADMIN]
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block - Combined actions for Remote Devices and Sensors
 * 
 *******************************************************************************************/

// Device actions (reuse from devices module)
const deviceActions = createDeviceActions({
    checkOwnership: true,
    enableCreate: false
});

export const actions: Actions = {
    // ===== Remote Devices Actions =====
    toggleStatus: async ({ request, locals }) => {
        return await deviceActions.toggleStatus({ request, locals });
    },

    delete: async ({ request, locals }) => {
        return await deviceActions.delete({ request, locals });
    },

    assignTags: async ({ request, locals }) => {
        return await deviceActions.assignTags({ request, locals });
    },

    getDeviceDetails: async ({ request, locals }) => {
        return await deviceActions.getDeviceDetails({ request, locals });
    },

    updateDevice: async ({ request, locals }) => {
        return await deviceActions.updateDevice({ request, locals });
    },

    // ===== Sensors Actions =====
    createSensor: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const { fail, redirect } = await import('@sveltejs/kit');
            const form = await superValidate(request, zod(radarSensorSchema));
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) return fail(403, { form, error: 'User account not found' });
            form.data.accountId = currentAccountId;

            const userId = (locals as { user?: { id: string } }).user?.id ?? 'unknown';

            if (!form.valid) {
                return fail(400, { form });
            }

            if (!form.data.pin?.trim()) {
                return fail(400, { form, error: 'Device registration code (PIN) is required. Enter the 6-digit code displayed on your device.' });
            }

            try {
                const pinResult = await resolveDeviceIdByPinForRadar(prisma, form.data.pin!, currentAccountId, userId);
                if (pinResult.error) return fail(400, { form, error: pinResult.error });
                const deviceId = pinResult.deviceId;
                const sensorDisplayName = await getRadarSensorDisplayNameForDevice(
                    prisma,
                    deviceId,
                    pinResult.displayName ?? 'Unknown device'
                );
                const serialNumber = form.data.serialNumber;
                if (!serialNumber) return fail(400, { form, error: 'Serial number is required' });

                const initConfigFromProfile = await buildRadarInitConfigFromDeviceProfile(
                    prisma,
                    deviceId,
                    currentAccountId,
                    sensorDisplayName
                );
                const sensorConfig =
                    initConfigFromProfile &&
                    typeof initConfigFromProfile === 'object' &&
                    Object.keys(initConfigFromProfile).length > 0
                        ? initConfigFromProfile
                        : {};

                await locals.prisma.sensor.deleteMany({
                    where: { serialNumber, accountId: currentAccountId, controller: { isDeleted: true } }
                });
                const existingSensor = await locals.prisma.sensor.findFirst({
                    where: { serialNumber },
                    include: { controller: true }
                });
                if (existingSensor) return fail(400, { form, error: 'A sensor with this serial number already exists' });

                const controllerSerial = `${serialNumber}-CTRL`;
                const softDeletedControllers = await locals.prisma.controller.findMany({
                    where: { serialNumber: controllerSerial, accountId: currentAccountId, isDeleted: true },
                    include: { sensors: true }
                });
                for (const ctrl of softDeletedControllers) {
                    for (const s of ctrl.sensors) await locals.prisma.sensor.delete({ where: { id: s.id } });
                    await locals.prisma.controller.delete({ where: { id: ctrl.id } });
                }
                const existingController = await locals.prisma.controller.findFirst({
                    where: { serialNumber: controllerSerial, isDeleted: false }
                });
                if (existingController) return fail(400, { form, error: 'Controller generation failed (Duplicate Serial). Please contact support.' });

                const result = await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
                    const controller = await tx.controller.create({
                        data: {
                            name: `${sensorDisplayName} Controller`,
                            serialNumber: controllerSerial,
                            status: form.data.status,
                            accountId: currentAccountId,
                            deviceId,
                            createdBy: userId,
                            type: 'radar'
                        }
                    });
                    const sensor = await tx.sensor.create({
                        data: {
                            name: sensorDisplayName,
                            serialNumber,
                            type: 'radar',
                            description: form.data.description,
                            location: form.data.location,
                            firmware: form.data.firmware,
                            status: form.data.status,
                            accountId: currentAccountId,
                            controllerId: controller.id,
                            createdBy: userId,
                            config: sensorConfig
                        }
                    });
                    return { controller, sensor };
                });

                logger.info(`User created Radar Controller & Sensor: ${result.controller.id} -> ${result.sensor.id}`);
                throw redirect(303, `/user/controllers/radar/${result.controller.id}`);
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 303) throw err;
                logger.error(`Error creating radar sensor:`, err);
                if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
                    return fail(400, { form, error: 'A controller or sensor with this serial number already exists. Please use a unique serial number.' });
                }
                return fail(500, { form, error: 'Failed to create radar sensor. Please try again or contact support.' });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    updateSensor: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            const currentAccountId = (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return { type: 'error', message: 'User account not found' };
            }
            const formData = await request.formData();
            const sensorId = formData.get('sensorId') as string | null;
            const name = (formData.get('name') as string | null)?.trim() ?? '';
            const location = (formData.get('location') as string | null)?.trim() ?? null;

            if (!sensorId) return { type: 'error', message: 'Sensor id is required' };
            if (!name) return { type: 'error', message: 'Sensor name is required' };
            if (name.length > 50) return { type: 'error', message: 'Name must be 50 characters or less' };
            if (location !== null && location.length > 200) return { type: 'error', message: 'Location must be 200 characters or less' };

            try {
                const sensor = await locals.prisma.sensor.findFirst({
                    where: { id: sensorId, accountId: currentAccountId, type: 'radar' }
                });
                if (!sensor) return { type: 'error', message: 'Sensor not found or access denied' };

                await prisma.sensor.update({
                    where: { id: sensorId },
                    data: { name, location: location || null, updatedAt: new Date() }
                });
                return { type: 'success' };
            } catch (err) {
                logger.error(`Error updating radar sensor ${sensorId}:`, err);
                return { type: 'error', message: 'Failed to update sensor. Please try again.' };
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    deleteSensor: restrict(
        async ({ request, locals }: AuthenticatedEvent) => {
            const currentAccountId = (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return { type: 'error', message: 'User account not found' };
            }
            const formData = await request.formData();
            const id = formData.get('id') as string | null;
            if (!id) {
                return { type: 'error', message: 'Sensor id is required' };
            }
            try {
                const sensor = await locals.prisma.sensor.findFirst({
                    where: { id, accountId: currentAccountId, type: 'radar' }
                });
                if (!sensor) {
                    return { type: 'error', message: 'Sensor not found or access denied' };
                }
                await locals.prisma.sensor.delete({ where: { id } });
                return { type: 'success' };
            } catch (err) {
                logger.error(`Error deleting radar sensor ${id}:`, err);
                return { type: 'error', message: err instanceof Error ? err.message : 'Failed to delete sensor' };
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    )
};
