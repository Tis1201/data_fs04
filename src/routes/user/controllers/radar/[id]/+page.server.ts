import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { radarSensorSchema } from '../new/radar-sensor';
import { z } from 'zod';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

// Type definitions for JSON Config
interface Zone {
    id: string;
    name: string;
    zoneNumber: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    description?: string;
    color?: string;
}

interface TrackingArea {
    id: string;
    name: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    description?: string;
}

interface DwellBucket {
    id: string;
    name: string;
    minDuration: number;
    maxDuration?: number;
    description?: string;
}

interface RadarConfig {
    trackingArea?: TrackingArea;
    zones?: Zone[];
    dwellBuckets?: DwellBucket[];
}

const trackingAreaSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }),
    startX: z.number(),
    startY: z.number().min(0, { message: 'Start Y cannot be negative' }),
    endX: z.number(),
    endY: z.number().min(0, { message: 'End Y cannot be negative' }),
    description: z.string().optional().nullable()
});

const zoneSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }),
    zoneNumber: z.number().int().min(1).max(5),
    startX: z.number().min(0, { message: 'Start X cannot be negative' }),
    startY: z.number().min(0, { message: 'Start Y cannot be negative' }),
    endX: z.number().min(0, { message: 'End X cannot be negative' }),
    endY: z.number().min(0, { message: 'End Y cannot be negative' }),
    description: z.string().optional().nullable(),
    color: z.string().optional().nullable()
});

const dwellBucketSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }),
    minDuration: z.number().int().min(0),
    maxDuration: z.number().int().min(0).optional().nullable(),
    description: z.string().optional().nullable()
});

// Helper to generate IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const load = restrict(
    async ({ params, locals }) => {
        const { id } = params; // This is the controller ID
        const accountId = locals.currentAccount?.account?.id;

        if (!accountId) {
            throw error(403, 'No account selected');
        }

        try {
            // First find the controller by ID
            const controller = await locals.prisma.controller.findUnique({
                where: {
                    id,
                    isDeleted: false
                },
                include: {
                    device: {
                        select: {
                            id: true,
                            name: true,
                            hardwareId: true,
                            connected: true
                        }
                    },
                    sensors: {
                        where: {
                            type: 'radar'
                        },
                        include: {
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

            if (!controller) {
                throw error(404, {
                    message: 'Controller not found',
                    code: 'CONTROLLER_NOT_FOUND'
                });
            }

            // Get the radar sensor from the controller
            let sensor = controller.sensors.find(s => s.type === 'radar');

            // Handle case where controller exists but sensor doesn't
            // This can happen with legacy controllers - auto-create the sensor
            if (!sensor) {
                // First verify ownership
                if (controller.accountId !== accountId) {
                    throw error(403, {
                        message: 'You do not have permission to access this controller',
                        code: 'FORBIDDEN'
                    });
                }

                // Auto-create sensor for this controller
                logger.info(`Auto-creating sensor for controller ${controller.id} (no sensor found)`);
                const sensorSerialNumber = `RADAR-SENSOR-${controller.id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

                sensor = await locals.prisma.sensor.create({
                    data: {
                        name: `Radar Sensor`,
                        type: 'radar',
                        serialNumber: sensorSerialNumber,
                        status: 'inactive',
                        controller: {
                            connect: { id: controller.id }
                        },
                        account: {
                            connect: { id: accountId }
                        },
                        config: {},
                        description: 'Auto-created when accessing controller'
                    },
                    include: {
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });

                logger.info(`Created sensor ${sensor.id} for controller ${controller.id}`);
            } else {
                // Sensor exists - verify ownership
                if (sensor.accountId !== accountId) {
                    throw error(403, {
                        message: 'You do not have permission to access this controller',
                        code: 'FORBIDDEN'
                    });
                }
            }

            const config = (sensor.config as unknown as RadarConfig) || {};

            // Build sensor object with controller reference
            const sensorWithController = {
                ...sensor,
                controller: {
                    ...controller,
                    device: controller.device
                }
            };

            const form = await superValidate(
                {
                    name: sensorWithController.name,
                    serialNumber: sensorWithController.serialNumber,
                    description: sensorWithController.description || '',
                    location: sensorWithController.location || '',
                    firmware: sensorWithController.firmware || '',
                    status: sensorWithController.status,
                    deviceId: controller.deviceId
                },
                zod(radarSensorSchema)
            );

            const trackingAreaForm = await superValidate(
                config.trackingArea ? {
                    name: config.trackingArea.name,
                    startX: config.trackingArea.startX,
                    startY: config.trackingArea.startY,
                    endX: config.trackingArea.endX,
                    endY: config.trackingArea.endY,
                    description: config.trackingArea.description || ''
                } : {},
                zod(trackingAreaSchema)
            );

            const zoneForm = await superValidate(zod(zoneSchema));
            const dwellBucketForm = await superValidate(zod(dwellBucketSchema));

            return {
                form,
                trackingAreaForm,
                zoneForm,
                dwellBucketForm,
                radarSensor: {
                    ...sensorWithController,
                    config
                },
                devices: []
            };
        } catch (err) {
            if (err.status === 404 || err.status === 403) {
                throw err;
            }
            logger.error(`Error loading sensor: ${err}`);
            throw error(500, 'Failed to load sensor details');
        }
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

// Helper function to verify ownership - handles both sensor and controller IDs
async function verifyOwnership(locals: any, id: string) {
    const accountId = locals.currentAccount?.account?.id;
    if (!accountId) {
        return { error: 'No account selected', status: 403 };
    }

    // First try to find as a sensor
    const sensor = await locals.prisma.sensor.findUnique({
        where: { id },
        select: { accountId: true, controllerId: true }
    });

    if (sensor) {
        if (sensor.accountId !== accountId) {
            return { error: 'You do not have permission to modify this sensor', status: 403 };
        }
        return { accountId, sensorId: id, controllerId: sensor.controllerId };
    }

    // Not a sensor - try as a controller (for auto-created controllers without sensors)
    const controller = await locals.prisma.controller.findUnique({
        where: { id },
        select: { accountId: true, id: true }
    });

    if (!controller) {
        return { error: 'Controller not found', status: 404 };
    }

    if (controller.accountId !== accountId) {
        return { error: 'You do not have permission to modify this controller', status: 403 };
    }

    // Return controller info with no sensor
    return { accountId, sensorId: null, controllerId: id };
}

export const actions: Actions = {
    updateSensor: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(radarSensorSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const existingSensor = await locals.prisma.sensor.findUnique({
                    where: { id }
                });

                if (!existingSensor) {
                    return fail(404, { error: 'Sensor not found' });
                }

                const sensor = await locals.prisma.sensor.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        serialNumber: form.data.serialNumber,
                        description: form.data.description,
                        location: form.data.location,
                        firmware: form.data.firmware,
                        status: form.data.status,
                    }
                });

                logger.info(`Sensor updated: ${sensor.id}`);
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Sensor',
                    recordId: sensor.id,
                    oldData: existingSensor,
                    newData: sensor,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return { form };
            } catch (err) {
                logger.error(`Error updating sensor: ${err}`);
                return fail(500, { form, error: 'Failed to update sensor' });
            }
        },
        [SystemRole.USER]
    ),

    createTrackingArea: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
            }

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (config.trackingArea) {
                    return fail(400, { error: 'Tracking area already exists' });
                }

                config.trackingArea = {
                    id: generateId(),
                    ...form.data,
                    description: form.data.description || undefined
                };

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                logger.info(`Tracking Area defined for sensor ${id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error creating tracking area: ${err}`);
                return fail(500, { error: 'Failed to create tracking area' });
            }
        },
        [SystemRole.USER]
    ),

    updateTrackingArea: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
            }

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (!config.trackingArea) {
                    return fail(404, { error: 'Tracking area not found' });
                }

                config.trackingArea = {
                    ...config.trackingArea,
                    ...form.data,
                    description: form.data.description || undefined
                };

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error updating tracking area: ${err}`);
                return fail(500, { error: 'Failed to update tracking area' });
            }
        },
        [SystemRole.USER]
    ),

    createZone: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(zoneSchema));

            if (!form.valid) {
                return fail(400, { zoneForm: form });
            }

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (!config.trackingArea) {
                    return fail(400, { error: 'Please create a tracking area first' });
                }

                if (!config.zones) config.zones = [];
                if (config.zones.length >= 5) {
                    return fail(400, { error: 'Maximum 5 zones allowed' });
                }

                config.zones.push({
                    id: generateId(),
                    ...form.data,
                    description: form.data.description || undefined,
                    color: form.data.color || undefined
                });

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error creating zone: ${err}`);
                return fail(500, { error: 'Failed to create zone' });
            }
        },
        [SystemRole.USER]
    ),

    deleteZone: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) return fail(400, { error: 'Zone ID is required' });

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.zones) return fail(400, { error: 'No zones found' });

                config.zones = config.zones.filter(z => z.id !== zoneId);

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error deleting zone: ${err}`);
                return fail(500, { error: 'Failed to delete zone' });
            }
        },
        [SystemRole.USER]
    ),

    updateZone: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(zoneSchema));
            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) return fail(400, { error: 'Zone ID is required' });
            if (!form.valid) return fail(400, { zoneForm: form });

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.zones) return fail(400, { error: 'No zones found' });

                const zoneIndex = config.zones.findIndex(z => z.id === zoneId);
                if (zoneIndex === -1) return fail(404, { error: 'Zone not found' });

                config.zones[zoneIndex] = {
                    ...config.zones[zoneIndex],
                    ...form.data,
                    description: form.data.description || undefined,
                    color: form.data.color || undefined
                };

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error updating zone: ${err}`);
                return fail(500, { error: 'Failed to update zone' });
            }
        },
        [SystemRole.USER]
    ),

    saveLayout: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const layoutJson = formData.get('layout')?.toString();

            if (!layoutJson) return fail(400, { error: 'Layout data missing' });

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const layout = JSON.parse(layoutJson);
                const { arena, zones } = layout;

                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                // Update Arena
                if (arena && config.trackingArea) {
                    config.trackingArea.startX = arena.startX;
                    config.trackingArea.startY = arena.startY;
                    config.trackingArea.endX = arena.endX;
                    config.trackingArea.endY = arena.endY;
                }

                // Update Zones
                if (zones && Array.isArray(zones) && config.zones) {
                    for (const z of zones) {
                        const existingZone = config.zones.find(ez => ez.id === z.id);
                        if (existingZone) {
                            existingZone.startX = z.startX;
                            existingZone.startY = z.startY;
                            existingZone.endX = z.endX;
                            existingZone.endY = z.endY;
                        }
                    }
                }

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                logger.info(`Layout saved for sensor ${id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error saving layout: ${err}`);
                return fail(500, { error: 'Failed to save layout' });
            }
        },
        [SystemRole.USER]
    ),

    createDwellBucket: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(dwellBucketSchema));

            if (!form.valid) return fail(400, { dwellBucketForm: form });

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.dwellBuckets) config.dwellBuckets = [];

                config.dwellBuckets.push({
                    id: generateId(),
                    ...form.data,
                    description: form.data.description || undefined
                });

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error creating dwell bucket: ${err}`);
                return fail(500, { error: 'Failed to create dwell bucket' });
            }
        },
        [SystemRole.USER]
    ),

    deleteDwellBucket: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const bucketId = formData.get('bucketId')?.toString();

            if (!bucketId) return fail(400, { error: 'Dwell Bucket ID is required' });

            const ownership = await verifyOwnership(locals, id);
            if ('error' in ownership) {
                return fail(ownership.status, { error: ownership.error });
            }

            try {
                const sensor = await locals.prisma.sensor.findUnique({ where: { id } });
                if (!sensor) return fail(404, { error: 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.dwellBuckets) return fail(400, { error: 'No dwell buckets found' });

                config.dwellBuckets = config.dwellBuckets.filter(b => b.id !== bucketId);

                await locals.prisma.sensor.update({
                    where: { id },
                    data: { config: config as any }
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error deleting dwell bucket: ${err}`);
                return fail(500, { error: 'Failed to delete dwell bucket' });
            }
        },
        [SystemRole.USER]
    ),

    deleteSensor: restrict(
        async ({ params, locals }) => {
            const { id } = params; // This is the controller ID

            const accountId = locals.currentAccount?.account?.id;
            if (!accountId) {
                return fail(403, { error: 'No account selected' });
            }

            try {
                // First find the controller by ID
                const controller = await locals.prisma.controller.findUnique({
                    where: {
                        id,
                        isDeleted: false
                    },
                    include: {
                        sensors: {
                            where: {
                                type: 'radar'
                            }
                        }
                    }
                });

                if (!controller) {
                    return fail(404, { error: 'Controller not found' });
                }

                // Get the radar sensor from the controller
                const sensor = controller.sensors.find(s => s.type === 'radar');

                if (!sensor) {
                    return fail(404, { error: 'Radar sensor not found for this controller' });
                }

                // Ownership check
                if (sensor.accountId !== accountId) {
                    return fail(403, { error: 'You do not have permission to delete this controller' });
                }

                // Start transaction
                const result = await locals.prisma.$transaction(async (tx) => {
                    // First soft delete the controller by marking isDeleted = true
                    const updatedController = await tx.controller.update({
                        where: { id: controller.id },
                        data: { isDeleted: true }
                    });

                    // Then delete the sensor
                    const deletedSensor = await tx.sensor.delete({
                        where: { id: sensor.id }
                    });

                    return { sensor: deletedSensor, controller: updatedController };
                });

                logger.info(`Sensor deleted: ${result.sensor.id}, Controller marked as deleted: ${result.controller.id}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Sensor',
                    recordId: result.sensor.id,
                    oldData: sensor,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error deleting sensor: ${err}`);
                return fail(500, { error: 'Failed to delete sensor' });
            }
        },
        [SystemRole.USER]
    )
};
