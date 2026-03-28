import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
// TODO: Re-enable ACL (restrictModule for USER_CONTROLLERS_RADAR) later.
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';
// TODO: Re-enable after subscription system is implemented
// import { checkDeviceLimit, LimitExceededError } from '$lib/server/entitlements';
import { radarSensorSchema } from '../../../admin/controllers/radar/new/radar-sensor';
import type { Prisma } from '@prisma/client';
import { validateBounds, normalizeBounds } from '$lib/components/ui_components_sveltekit/radar/constraints';
// Raw Prisma for sensor.update: access is enforced by checkAccountAccess + restrictModule; ZenStack policy only allows account members 'read' on Sensor, so we use unenhanced client for updates.
import prisma from '$lib/server/prisma';
import { areDevicesOnline } from '$lib/server/device/devicePresence';
import { resolveDeviceIdByPinForRadar } from '$lib/server/device/radarPinClaim';
import { buildRadarAddDeviceStep2FromClaimedDevice } from '$lib/server/device/radarAddDeviceProfileStep2';

export const load = restrict(
    async ({ url, locals, cookies, depends }: AuthenticatedLoadEvent) => {
        depends('app:userControllersRadar');
        // Get current account ID from cookie or locals
        const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
        if (!currentAccountId) {
            throw error(403, 'User account not found');
        }
        
        // Get user for permission check
        const user = (locals as any).user;

        try {
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = (url.searchParams.get('sort_order') || 'desc') as 'asc' | 'desc';
            const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
            const locations = url.searchParams.get('locations')?.split(',').filter(Boolean) || [];

            const skip = (page - 1) * perPage;
            const take = perPage;

            const where: Prisma.SensorWhereInput = {
                type: 'radar',
                accountId: currentAccountId // Account-scoped
            };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { location: { contains: search, mode: 'insensitive' } },
                    { controller: { device: { name: { contains: search, mode: 'insensitive' } } } },
                    { controller: { device: { macAddress: { contains: search, mode: 'insensitive' } } } }
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
                        controller: {
                            isDeleted: false // Only show sensors with non-deleted controllers
                        }
                    },
                    orderBy: {
                        [sortField]: sortOrder
                    },
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
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        controller: {
                            select: {
                                id: true,
                                name: true,
                                device: {
                                    select: {
                                        id: true,
                                        name: true,
                                        macAddress: true
                                    }
                                }
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

            // Fetch module permissions for the current user in this account
            const modulePermissions = user?.id 
                ? await getUserModulePermissions(user.id, currentAccountId)
                : {};

            // When opening from detail page "Edit Device", load the sensor to open Edit Device modal
            const editSensorId = url.searchParams.get('editSensorId');
            let editSensor: typeof sensors[0] | null = null;
            if (editSensorId && editSensorId.trim()) {
                const one = await locals.prisma.sensor.findFirst({
                    where: {
                        id: editSensorId.trim(),
                        type: 'radar',
                        accountId: currentAccountId,
                        controller: { isDeleted: false }
                    },
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
                });
                if (one) editSensor = one;
            }

            // Enrich radar sensors with device connection status (Redis/MQTT presence) – batch lookup
            const deviceIds = sensors
                .map((s: { controller?: { device?: { id: string } } }) => s.controller?.device?.id)
                .filter((id): id is string => !!id);
            let presenceMap = new Map<string, boolean>();
            try {
                presenceMap = await areDevicesOnline(deviceIds);
            } catch (e) {
                logger.warn(`[Radar] Failed batch device presence check: ${e}`);
            }
            const radarSensorsEnriched = sensors.map((sensor: { controller?: { device?: { id: string } } }) => {
                const deviceId = sensor.controller?.device?.id;
                const connected = deviceId ? (presenceMap.get(deviceId) ?? false) : false;
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

            return {
                radarSensors: radarSensorsEnriched,
                currentAccountId,
                meta: {
                    totalItems: totalSensors,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {},
                sort: {
                    field: sortField,
                    order: sortOrder
                },
                availableLocations,
                modulePermissions,
                user: user ? { id: user.id, systemRole: user.systemRole } : null,
                editSensor
            };
        } catch (err) {
            logger.error(`Error loading radar sensors: ${err}`);
            throw error(500, 'Failed to load radar sensors');
        }
    },
    [SystemRole.USER, SystemRole.ADMIN]
) satisfies PageServerLoad;

/**
 * Create controller + sensor (Add Device modal). Uses PIN (Device Registration Code); claim is independent from Devices module.
 */
async function createRadarController(
    request: Request,
    locals: AuthenticatedEvent['locals'],
    cookies: AuthenticatedEvent['cookies']
) {
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
        const pinResult = await resolveDeviceIdByPinForRadar(
            prisma,
            form.data.pin!,
            currentAccountId,
            userId
        );
        if (pinResult.error) return fail(400, { form, error: pinResult.error });
        const deviceId = pinResult.deviceId;
        const sensorDisplayName = pinResult.displayName ?? 'Unknown device';
        const serialNumber = form.data.serialNumber;
        if (!serialNumber) return fail(400, { form, error: 'Serial number is required' });

        // Clean up soft-deleted sensors in current account only
        await locals.prisma.sensor.deleteMany({
            where: { serialNumber, accountId: currentAccountId, controller: { isDeleted: true } }
        });
        // Check if serial number already exists (globally unique)
        const existingSensor = await locals.prisma.sensor.findFirst({
            where: { serialNumber },
            include: { controller: true }
        });
        if (existingSensor) return fail(400, { form, error: 'A sensor with this serial number already exists' });

        const controllerSerial = `${serialNumber}-CTRL`;
        // Clean up soft-deleted controllers in current account only
        const softDeletedControllers = await locals.prisma.controller.findMany({
            where: { serialNumber: controllerSerial, accountId: currentAccountId, isDeleted: true },
            include: { sensors: true }
        });
        for (const ctrl of softDeletedControllers) {
            for (const s of ctrl.sensors) await locals.prisma.sensor.delete({ where: { id: s.id } });
            await locals.prisma.controller.delete({ where: { id: ctrl.id } });
        }
        // Check if controller already exists (globally unique)
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
                    config: {}
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
}

/**
 * Create Controller + Sensor for an already-claimed device (used after device.claim RPC + confirmation).
 * Device must exist, belong to current account, and have no radar controller yet.
 */
async function createSensorForDevice(
    request: Request,
    locals: AuthenticatedEvent['locals'],
    cookies: AuthenticatedEvent['cookies']
): Promise<{ type: 'success'; controllerId: string } | { type: 'error'; message: string }> {
    const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
    if (!currentAccountId) {
        return { type: 'error', message: 'User account not found' };
    }
    const userId = (locals as { user?: { id: string } }).user?.id ?? 'unknown';
    const formData = await request.formData();
    const deviceId = (formData.get('deviceId') as string | null)?.trim();
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const serialNumber = (formData.get('serialNumber') as string | null)?.trim() ?? '';
    const description = (formData.get('description') as string | null)?.trim() ?? '';
    const location = (formData.get('location') as string | null)?.trim() ?? '';
    const firmware = (formData.get('firmware') as string | null)?.trim() ?? '';
    const status = ((formData.get('status') as string | null)?.trim() || 'ACTIVE') as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
    const initConfigRaw = (formData.get('initConfig') as string | null)?.trim();
    let initConfig: Prisma.InputJsonValue = {};
    if (initConfigRaw) {
        try {
            initConfig = JSON.parse(initConfigRaw) as Prisma.InputJsonValue;
            const cfg = initConfig as { trackingArea?: { startX?: number; startY?: number; endX?: number; endY?: number }; zones?: Array<{ startX?: number; startY?: number; endX?: number; endY?: number }> };
            if (cfg.trackingArea) {
                const sx = Number(cfg.trackingArea.startX);
                const sy = Number(cfg.trackingArea.startY);
                const ex = Number(cfg.trackingArea.endX);
                const ey = Number(cfg.trackingArea.endY);
                if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(ex) || !Number.isFinite(ey)) {
                    return { type: 'error', message: 'Invalid Tracking Area: coordinates must be numbers' };
                }
                const ta = { startX: sx, startY: sy, endX: ex, endY: ey };
                const taNorm = normalizeBounds(ta);
                const taVal = validateBounds(taNorm);
                if (!taVal.valid) return { type: 'error', message: `Invalid Tracking Area: ${taVal.errors[0] ?? 'Out of range'}` };
            }
            if (cfg.zones && Array.isArray(cfg.zones)) {
                for (let i = 0; i < cfg.zones.length; i++) {
                    const z = cfg.zones[i];
                    const zx = Number(z?.startX);
                    const zy = Number(z?.startY);
                    const zex = Number(z?.endX);
                    const zey = Number(z?.endY);
                    if (!Number.isFinite(zx) || !Number.isFinite(zy) || !Number.isFinite(zex) || !Number.isFinite(zey)) {
                        return { type: 'error', message: `Invalid zone ${i + 1}: coordinates must be numbers` };
                    }
                    const zb = { startX: zx, startY: zy, endX: zex, endY: zey };
                    const zbNorm = normalizeBounds(zb);
                    const zbVal = validateBounds(zbNorm);
                    if (!zbVal.valid) return { type: 'error', message: `Invalid zone ${i + 1}: ${zbVal.errors[0] ?? 'Out of range'}` };
                }
            }
        } catch (e) {
            initConfig = {};
        }
    }

    if (!deviceId) return { type: 'error', message: 'Device ID is required' };
    if (!serialNumber) return { type: 'error', message: 'Serial number is required' };

    try {
        const device = await locals.prisma.device.findFirst({
            where: { id: deviceId, accountId: currentAccountId },
            include: { controllers: { where: { type: 'radar', isDeleted: false } } }
        });
        if (!device) {
            return { type: 'error', message: 'Device not found or access denied' };
        }

        // After MQTT claim, Device.name is typically `device - AA:BB:...`. Allow empty form name to match device + sensor.
        const sensorDisplayName = (name || device.name || '').trim() || 'Unknown device';

        if (device.controllers.length > 0) {
            // Handle race condition: physical device may have called GET /api/device/controller before
            // the wizard ran, causing an auto-created controller with default config (no device settings).
            // If the existing controller was auto-created, update its sensor config with the wizard's
            // initConfig (which contains the user-specified device settings) instead of failing.
            const existingController = device.controllers[0];
            const isAutoCreated = existingController.description === 'Auto-created during config retrieval';
            if (isAutoCreated && Object.keys(initConfig as object).length > 0) {
                const existingSensorForUpdate = await locals.prisma.sensor.findFirst({
                    where: { controllerId: existingController.id, type: 'radar' }
                });

                // Guard: if the wizard-provided serialNumber is already used by a different sensor, reject.
                if (serialNumber && existingSensorForUpdate && existingSensorForUpdate.serialNumber !== serialNumber) {
                    const serialConflict = await locals.prisma.sensor.findFirst({
                        where: { serialNumber, NOT: { id: existingSensorForUpdate.id } }
                    });
                    if (serialConflict) {
                        return { type: 'error', message: 'A sensor with this serial number already exists' };
                    }
                }

                // Update controller name/info to match wizard input
                await locals.prisma.controller.update({
                    where: { id: existingController.id },
                    data: {
                        name: `${sensorDisplayName} Controller`,
                        description: null,
                        status,
                        createdBy: userId,
                        updatedAt: new Date()
                    }
                });
                // Single sensor update — merge config + metadata in one write
                if (existingSensorForUpdate) {
                    await locals.prisma.sensor.update({
                        where: { id: existingSensorForUpdate.id },
                        data: {
                            name: sensorDisplayName,
                            ...(serialNumber ? { serialNumber } : {}),
                            config: initConfig as Prisma.InputJsonValue,
                            description: description || null,
                            location: location || null,
                            firmware: firmware || null,
                            status,
                            createdBy: userId,
                            updatedAt: new Date()
                        }
                    });
                }
                logger.info(`Updated auto-created controller ${existingController.id} with wizard config for device ${deviceId}`);
                return { type: 'success', controllerId: existingController.id };
            }
            return { type: 'error', message: 'This device already has an active radar sensor. Only one sensor per device is allowed.' };
        }

        // Clean up soft-deleted sensors in current account only
        await locals.prisma.sensor.deleteMany({
            where: { serialNumber, accountId: currentAccountId, controller: { isDeleted: true } }
        });
        // Check if serial number already exists (globally unique)
        const existingSensor = await locals.prisma.sensor.findFirst({
            where: { serialNumber },
            include: { controller: true }
        });
        if (existingSensor) return { type: 'error', message: 'A sensor with this serial number already exists' };

        const controllerSerial = `${serialNumber}-CTRL`;
        // Clean up soft-deleted controllers in current account only
        const softDeletedControllers = await locals.prisma.controller.findMany({
            where: { serialNumber: controllerSerial, accountId: currentAccountId, isDeleted: true },
            include: { sensors: true }
        });
        for (const ctrl of softDeletedControllers) {
            for (const s of ctrl.sensors) await locals.prisma.sensor.delete({ where: { id: s.id } });
            await locals.prisma.controller.delete({ where: { id: ctrl.id } });
        }
        // Check if controller already exists (globally unique)
        const existingController = await locals.prisma.controller.findFirst({
            where: { serialNumber: controllerSerial, isDeleted: false }
        });
        if (existingController) return { type: 'error', message: 'Controller generation failed (Duplicate Serial). Please contact support.' };

        const result = await locals.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const controller = await tx.controller.create({
                data: {
                    name: `${sensorDisplayName} Controller`,
                    serialNumber: controllerSerial,
                    status,
                    accountId: currentAccountId,
                    deviceId,
                    createdBy: userId,
                    type: 'radar'
                }
            });
            await tx.sensor.create({
                data: {
                    name: sensorDisplayName,
                    serialNumber,
                    type: 'radar',
                    description: description || null,
                    location: location || null,
                    firmware: firmware || null,
                    status,
                    accountId: currentAccountId,
                    controllerId: controller.id,
                    createdBy: userId,
                    config: Object.keys(initConfig as object).length > 0 ? initConfig : {}
                }
            });
            return { controller };
        });

        logger.info(`User created Radar Controller & Sensor for device ${deviceId}: ${result.controller.id}`);
        return { type: 'success', controllerId: result.controller.id };
    } catch (err: unknown) {
        logger.error(`Error creating radar sensor for device:`, err);
        if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
            return { type: 'error', message: 'A controller or sensor with this serial number already exists. Please use a unique serial number.' };
        }
        return { type: 'error', message: 'Failed to create radar sensor. Please try again or contact support.' };
    }
}

/**
 * After claim on Add Device step 1: load effective device profile and Step 2 defaults (timezone + optional radar JSON).
 */
async function radarProfileForClaimedDevice(
    request: Request,
    locals: AuthenticatedEvent['locals'],
    cookies: AuthenticatedEvent['cookies']
) {
    const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
    if (!currentAccountId) {
        return fail(403, { message: 'User account not found' });
    }
    const formData = await request.formData();
    const deviceId = (formData.get('deviceId') as string | null)?.trim();
    if (!deviceId) {
        return fail(400, { message: 'Device ID is required' });
    }
    const payload = await buildRadarAddDeviceStep2FromClaimedDevice(locals.prisma, deviceId, currentAccountId);
    if (!payload) {
        return fail(403, { message: 'Device not found or access denied' });
    }
    return {
        locked: payload.locked,
        profileName: payload.profileName,
        deviceName: payload.deviceName,
        step2: payload.step2
    };
}

/**
 * Update sensor (name, location) from Edit Device modal - requires EDIT permission on USER_CONTROLLERS_RADAR.
 */
async function updateSensorFromList(
    request: Request,
    locals: AuthenticatedEvent['locals']
): Promise<{ type: 'success' } | { type: 'error'; message: string }> {
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
        // Use ZenStack enhanced client for read (access check)
        const sensor = await locals.prisma.sensor.findFirst({
            where: { id: sensorId, accountId: currentAccountId, type: 'radar' }
        });
        if (!sensor) return { type: 'error', message: 'Sensor not found or access denied' };

        // Use raw prisma for update (ZenStack policy only allows 'read' for account members)
        await prisma.sensor.update({
            where: { id: sensorId },
            data: { name, location: location || null, updatedAt: new Date() }
        });
        return { type: 'success' };
    } catch (err) {
        logger.error(`Error updating radar sensor ${sensorId}:`, err);
        return { type: 'error', message: 'Failed to update sensor. Please try again.' };
    }
}

/**
 * Delete sensor action - requires DELETE permission on USER_CONTROLLERS_RADAR.
 */
export const actions: Actions = {
    create: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => createRadarController(request, locals, cookies),
        [SystemRole.USER, SystemRole.ADMIN]
    ),
    createSensorForDevice: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => createSensorForDevice(request, locals, cookies),
        [SystemRole.USER, SystemRole.ADMIN]
    ),
    radarProfileForClaimedDevice: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => radarProfileForClaimedDevice(request, locals, cookies),
        [SystemRole.USER, SystemRole.ADMIN]
    ),
    updateSensor: restrict(
        async ({ request, locals }: AuthenticatedEvent) => updateSensorFromList(request, locals),
        [SystemRole.USER, SystemRole.ADMIN]
    ),
    delete: restrict(
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


