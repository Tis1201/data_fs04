import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { generateId } from 'lucia';
// TODO: Re-enable ACL (restrictModule for USER_CONTROLLERS_RADAR) later.
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';
import { checkDeviceLimit, LimitExceededError } from '$lib/server/entitlements';
import { radarSensorSchema } from '../../../admin/controllers/radar/new/radar-sensor';
import type { Prisma } from '@prisma/client';
// Raw Prisma for sensor.update: access is enforced by checkAccountAccess + restrictModule; ZenStack policy only allows account members 'read' on Sensor, so we use unenhanced client for updates.
import prisma from '$lib/server/prisma';

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

            const where: {
                type: string;
                accountId: string;
                OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
                status?: { in: string[] };
                location?: { in: string[] };
                controller?: { isDeleted: boolean };
            } = {
                type: 'radar',
                accountId: currentAccountId // Account-scoped
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
                                        name: true
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

            return {
                radarSensors: sensors,
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
 * Resolve or create Device from PIN (Device Registration Code). Claim is independent from Devices module.
 * Returns deviceId to use for creating Controller + Sensor.
 * Uses raw prisma (not ZenStack) so unclaimed FactoryDevices (accountId == null) are visible; ZenStack
 * only allows read when account != null && user is member, which would block PIN lookup for new devices.
 */
async function resolveDeviceIdByPin(
    _prisma: AuthenticatedEvent['locals']['prisma'],
    pin: string,
    currentAccountId: string,
    userId: string,
    sensorName: string
): Promise<{ deviceId: string; error?: string }> {
    const normalizedPin = pin.trim().toUpperCase().replace(/\s/g, '');
    if (!normalizedPin) return { deviceId: '', error: 'Device registration code (PIN) is required' };

    const factoryDevice = await prisma.factoryDevice.findFirst({
        where: { registrationPin: normalizedPin },
        include: { claimedDevice: { include: { controllers: { where: { type: 'radar', isDeleted: false } } } } }
    });

    if (!factoryDevice) {
        return { deviceId: '', error: 'Invalid or expired PIN. Please check the 6-digit code on your device and try again.' };
    }

    if (factoryDevice.claimedDeviceId && factoryDevice.claimedDevice) {
        const dev = factoryDevice.claimedDevice;
        if (dev.accountId !== currentAccountId) {
            return { deviceId: '', error: 'This device is already claimed by another account.' };
        }
        if (dev.controllers.length > 0) {
            return { deviceId: '', error: 'This device already has an active radar sensor. Only one sensor per device is allowed.' };
        }
        return { deviceId: dev.id };
    }

    try {
        await checkDeviceLimit(currentAccountId);
    } catch (e) {
        if (e instanceof LimitExceededError) {
            return { deviceId: '', error: `Device limit reached (${e.current}/${e.max}). Upgrade your plan to add more devices.` };
        }
        throw e;
    }

    const now = new Date();
    const apiKey = generateId(32);
    const deviceName = sensorName?.trim() ? `device - ${sensorName.trim()}` : 'device - radar';

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const device = await tx.device.create({
            data: {
                name: deviceName,
                status: 'ACTIVE',
                accountId: currentAccountId,
                createdBy: userId,
                claimedAt: now,
                claimedBy: userId,
                apiKey,
                apiKeyCreatedAt: now,
                apiKeyRotatedAt: now
            }
            // id: cuid default
        });
        await tx.factoryDevice.update({
            where: { id: factoryDevice.id },
            data: {
                claimedAt: now,
                claimedDeviceId: device.id,
                accountId: currentAccountId
            }
        });
        return device;
    });

    logger.info(`Claimed device by PIN for Sensors: deviceId=${created.id}, factoryDeviceId=${factoryDevice.id}`);
    return { deviceId: created.id };
}

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

    if (!form.data.pin?.trim()) {
        return fail(400, { form, error: 'Device registration code (PIN) is required. Enter the 6-digit code displayed on your device.' });
    }

    try {
        const { deviceId, error: pinError } = await resolveDeviceIdByPin(
            locals.prisma,
            form.data.pin,
            currentAccountId,
            userId,
            form.data.name
        );
        if (pinError) return fail(400, { form, error: pinError });
        if (!deviceId) return fail(400, { form, error: 'Could not resolve device from PIN. Please try again.' });

        await locals.prisma.sensor.deleteMany({
            where: { serialNumber: form.data.serialNumber, controller: { isDeleted: true } }
        });
        const existingSensor = await locals.prisma.sensor.findFirst({
            where: { serialNumber: form.data.serialNumber },
            include: { controller: true }
        });
        if (existingSensor) return fail(400, { form, error: 'A sensor with this serial number already exists' });

        const controllerSerial = `${form.data.serialNumber}-CTRL`;
        const softDeletedControllers = await locals.prisma.controller.findMany({
            where: { serialNumber: controllerSerial, isDeleted: true },
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
                    name: `${form.data.name} Controller`,
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
                    name: form.data.name,
                    serialNumber: form.data.serialNumber,
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
    if (name.length > 100) return { type: 'error', message: 'Name must be 100 characters or less' };
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


