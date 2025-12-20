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

export const load = restrict(
    async ({ params, locals }) => {
        const { id } = params;

        try {
            const radarSensor = await locals.prisma.radarSensor.findUnique({
                where: { id },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    device: {
                        select: {
                            id: true,
                            name: true,
                            hardwareId: true
                        }
                    },
                    trackingArea: {
                        include: {
                            zones: {
                                orderBy: {
                                    zoneNumber: 'asc'
                                }
                            }
                        }
                    },
                    dwellBuckets: {
                        orderBy: {
                            minDuration: 'asc'
                        }
                    }
                }
            });

            if (!radarSensor) {
                throw error(404, {
                    message: 'Radar Sensor not found',
                    code: 'RADAR_SENSOR_NOT_FOUND'
                });
            }

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

            const devices = await locals.prisma.device.findMany({
                where: {
                    OR: [
                        { radarSensor: null },
                        { id: radarSensor.deviceId }
                    ]
                },
                select: {
                    id: true,
                    name: true,
                    hardwareId: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            const form = await superValidate(
                {
                    name: radarSensor.name,
                    serialNumber: radarSensor.serialNumber,
                    description: radarSensor.description || '',
                    location: radarSensor.location || '',
                    firmware: radarSensor.firmware || '',
                    status: radarSensor.status,
                    accountId: radarSensor.accountId,
                    deviceId: radarSensor.deviceId || ''
                },
                zod(radarSensorSchema)
            );

            const trackingAreaForm = await superValidate(
                radarSensor.trackingArea ? {
                    name: radarSensor.trackingArea.name,
                    startX: radarSensor.trackingArea.startX,
                    startY: radarSensor.trackingArea.startY,
                    endX: radarSensor.trackingArea.endX,
                    endY: radarSensor.trackingArea.endY,
                    description: radarSensor.trackingArea.description || ''
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
                radarSensor,
                accounts,
                devices
            };
        } catch (err) {
            if (err.status === 404) {
                throw err;
            }
            logger.error(`Error loading radar sensor: ${err}`);
            throw error(500, 'Failed to load radar sensor details');
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
                const existingSensor = await locals.prisma.radarSensor.findUnique({
                    where: { id }
                });

                if (!existingSensor) {
                    return fail(404, { error: 'Radar Sensor not found' });
                }

                const radarSensor = await locals.prisma.radarSensor.update({
                    where: { id },
                    data: {
                        name: form.data.name,
                        serialNumber: form.data.serialNumber,
                        description: form.data.description,
                        location: form.data.location,
                        firmware: form.data.firmware,
                        status: form.data.status,
                        accountId: form.data.accountId,
                        deviceId: form.data.deviceId || null
                    }
                });

                logger.info(`Radar Sensor updated: ${radarSensor.id} (${radarSensor.serialNumber})`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'RadarSensor',
                    recordId: radarSensor.id,
                    oldData: existingSensor,
                    newData: radarSensor,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return { form };
            } catch (err) {
                logger.error(`Error updating radar sensor: ${err}`);
                return fail(500, { form, error: 'Failed to update radar sensor' });
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
                const existingArea = await locals.prisma.trackingArea.findUnique({
                    where: { radarSensorId: id }
                });

                if (existingArea) {
                    return fail(400, { error: 'Tracking area already exists for this sensor' });
                }

                const trackingArea = await locals.prisma.trackingArea.create({
                    data: {
                        name: form.data.name,
                        startX: form.data.startX,
                        startY: form.data.startY,
                        endX: form.data.endX,
                        endY: form.data.endY,
                        description: form.data.description,
                        radarSensorId: id
                    }
                });

                logger.info(`Tracking Area created: ${trackingArea.id} for sensor ${id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'TrackingArea',
                    recordId: trackingArea.id,
                    oldData: null,
                    newData: trackingArea,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

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
                const existingArea = await locals.prisma.trackingArea.findUnique({
                    where: { radarSensorId: id }
                });

                if (!existingArea) {
                    return fail(404, { error: 'Tracking area not found' });
                }

                const trackingArea = await locals.prisma.trackingArea.update({
                    where: { radarSensorId: id },
                    data: {
                        name: form.data.name,
                        startX: form.data.startX,
                        startY: form.data.startY,
                        endX: form.data.endX,
                        endY: form.data.endY,
                        description: form.data.description
                    }
                });

                logger.info(`Tracking Area updated: ${trackingArea.id}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'TrackingArea',
                    recordId: trackingArea.id,
                    oldData: existingArea,
                    newData: trackingArea,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
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
                const trackingArea = await locals.prisma.trackingArea.findUnique({
                    where: { radarSensorId: id },
                    include: { _count: { select: { zones: true } } }
                });

                if (!trackingArea) {
                    return fail(400, { error: 'Please create a tracking area first' });
                }

                if (trackingArea._count.zones >= 5) {
                    return fail(400, { error: 'Maximum 5 zones allowed per tracking area' });
                }

                const zone = await locals.prisma.zone.create({
                    data: {
                        name: form.data.name,
                        zoneNumber: form.data.zoneNumber,
                        startX: form.data.startX,
                        startY: form.data.startY,
                        endX: form.data.endX,
                        endY: form.data.endY,
                        description: form.data.description,
                        color: form.data.color,
                        trackingAreaId: trackingArea.id
                    }
                });

                logger.info(`Zone created: ${zone.id} for tracking area ${trackingArea.id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'Zone',
                    recordId: zone.id,
                    oldData: null,
                    newData: zone,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
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
        async ({ request, locals }) => {
            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) {
                return fail(400, { error: 'Zone ID is required' });
            }

            try {
                const zone = await locals.prisma.zone.delete({
                    where: { id: zoneId }
                });

                logger.info(`Zone deleted: ${zone.id}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Zone',
                    recordId: zone.id,
                    oldData: zone,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
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
        async ({ request, locals }) => {
            const form = await superValidate(request, zod(zoneSchema));
            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) {
                return fail(400, { error: 'Zone ID is required' });
            }

            if (!form.valid) {
                // In a real modal scenario, returning form errors to a specific instance is tricky without mapping.
                // We'll return errors but UI might need generic error handling.
                return fail(400, { zoneForm: form });
            }

            try {
                const zone = await locals.prisma.zone.update({
                    where: { id: zoneId },
                    data: {
                        name: form.data.name,
                        zoneNumber: form.data.zoneNumber,
                        startX: form.data.startX,
                        startY: form.data.startY,
                        endX: form.data.endX,
                        endY: form.data.endY,
                        description: form.data.description,
                        color: form.data.color
                    }
                });

                logger.info(`Zone updated: ${zone.id}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Zone',
                    recordId: zone.id,
                    oldData: null, // Full diff not fetched for perf optimization in this tailored action
                    newData: zone,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
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

            if (!layoutJson) {
                return fail(400, { error: 'Layout data missing' });
            }

            try {
                const layout = JSON.parse(layoutJson);
                const { arena, zones } = layout;

                // Update Arena
                if (arena) {
                    await locals.prisma.trackingArea.update({
                        where: { radarSensorId: id },
                        data: {
                            startX: arena.startX,
                            startY: arena.startY,
                            endX: arena.endX,
                            endY: arena.endY
                        }
                    });
                }

                // Update Zones
                if (zones && Array.isArray(zones)) {
                    // We doing a loop here for simplicity. 
                    // In high-scale this should be a transaction, but for <5 zones it's fine.
                    for (const z of zones) {
                        if (z.id) {
                            await locals.prisma.zone.update({
                                where: { id: z.id },
                                data: {
                                    startX: z.startX,
                                    startY: z.startY,
                                    endX: z.endX,
                                    endY: z.endY
                                }
                            });
                        }
                    }
                }

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

            if (!form.valid) {
                return fail(400, { dwellBucketForm: form });
            }

            try {
                const dwellBucket = await locals.prisma.dwellBucket.create({
                    data: {
                        name: form.data.name,
                        minDuration: form.data.minDuration,
                        maxDuration: form.data.maxDuration,
                        description: form.data.description,
                        radarSensorId: id
                    }
                });

                logger.info(`Dwell Bucket created: ${dwellBucket.id} for sensor ${id}`);

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'DwellBucket',
                    recordId: dwellBucket.id,
                    oldData: null,
                    newData: dwellBucket,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
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
        async ({ request, locals }) => {
            const formData = await request.formData();
            const bucketId = formData.get('bucketId')?.toString();

            if (!bucketId) {
                return fail(400, { error: 'Dwell Bucket ID is required' });
            }

            try {
                const bucket = await locals.prisma.dwellBucket.delete({
                    where: { id: bucketId }
                });

                logger.info(`Dwell Bucket deleted: ${bucket.id}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'DwellBucket',
                    recordId: bucket.id,
                    oldData: bucket,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
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
                const sensor = await locals.prisma.radarSensor.delete({
                    where: { id }
                });

                logger.info(`Radar Sensor deleted: ${sensor.id}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'RadarSensor',
                    recordId: sensor.id,
                    oldData: sensor,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                return { success: true };
            } catch (err) {
                logger.error(`Error deleting radar sensor: ${err}`);
                return fail(500, { error: 'Failed to delete radar sensor' });
            }
        },
        [SystemRole.ADMIN]
    )
};
