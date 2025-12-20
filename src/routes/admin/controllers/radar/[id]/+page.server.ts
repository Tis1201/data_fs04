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
    id: string; // generated ID (UUID/CUID)
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
    id: string; // generated ID
    name: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    description?: string;
}

interface DwellBucket {
    id: string; // generated ID
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
        const { id } = params;

        try {
            const sensor = await locals.prisma.sensor.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    controller: {
                        include: {
                            device: {
                                select: {
                                    id: true,
                                    name: true,
                                    hardwareId: true
                                }
                            }
                        }
                    }
                }
            });

            if (!sensor) {
                throw error(404, {
                    message: 'Sensor not found',
                    code: 'SENSOR_NOT_FOUND'
                });
            }

            const config = (sensor.config as unknown as RadarConfig) || {};

            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            const form = await superValidate(
                {
                    name: sensor.name,
                    serialNumber: sensor.serialNumber,
                    description: sensor.description || '',
                    location: sensor.location || '',
                    firmware: sensor.firmware || '',
                    status: sensor.status,
                    accountId: sensor.accountId,
                    deviceId: sensor.controller?.deviceId || ''
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
                    ...sensor,
                    config, // Explicitly pass typed config
                    device: sensor.controller?.device // Flatten for UI compatibility if needed
                },
                accounts,
                devices: [] // Simplify for now
            };
        } catch (err) {
            if (err.status === 404) {
                throw err;
            }
            logger.error(`Error loading sensor: ${err}`);
            throw error(500, 'Failed to load sensor details');
        }
    },
    [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
    updateSensor: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(radarSensorSchema));

            if (!form.valid) {
                return fail(400, { form });
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
                        accountId: form.data.accountId,
                        // Not updating controller/device link here for simplicity unless requested
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
        [SystemRole.ADMIN]
    ),

    createTrackingArea: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
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
        [SystemRole.ADMIN]
    ),

    updateTrackingArea: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
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
        [SystemRole.ADMIN]
    ),

    createZone: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(zoneSchema));

            if (!form.valid) {
                return fail(400, { zoneForm: form });
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
        [SystemRole.ADMIN]
    ),

    deleteZone: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) return fail(400, { error: 'Zone ID is required' });

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
        [SystemRole.ADMIN]
    ),

    updateZone: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(zoneSchema));
            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) return fail(400, { error: 'Zone ID is required' });
            if (!form.valid) return fail(400, { zoneForm: form });

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
        [SystemRole.ADMIN]
    ),

    saveLayout: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const layoutJson = formData.get('layout')?.toString();

            if (!layoutJson) return fail(400, { error: 'Layout data missing' });

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
        [SystemRole.ADMIN]
    ),

    createDwellBucket: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const form = await superValidate(request, zod(dwellBucketSchema));

            if (!form.valid) return fail(400, { dwellBucketForm: form });

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
        [SystemRole.ADMIN]
    ),

    deleteDwellBucket: restrict(
        async ({ request, params, locals }) => {
            const { id } = params;
            const formData = await request.formData();
            const bucketId = formData.get('bucketId')?.toString();

            if (!bucketId) return fail(400, { error: 'Dwell Bucket ID is required' });

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
        [SystemRole.ADMIN]
    ),

    deleteSensor: restrict(
        async ({ params, locals }) => {
            const { id } = params;

            try {
                const sensor = await locals.prisma.sensor.delete({
                    where: { id }
                });

                logger.info(`Sensor deleted: ${sensor.id}`);
                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Sensor',
                    recordId: sensor.id,
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
        [SystemRole.ADMIN]
    )
};
