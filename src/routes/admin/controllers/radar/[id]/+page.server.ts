import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { radarSensorSchema } from '../new/radar-sensor';
import { z } from 'zod';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import type { PrismaClient, Prisma } from '@prisma/client';
import { validateBounds, clampBounds, normalizeBounds, RADAR_CONSTRAINTS } from '$lib/components/ui_components_sveltekit/radar/constraints';

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

export interface RadarConfig {
    trackingArea?: TrackingArea;
    zones?: Zone[];
    dwellBuckets?: DwellBucket[];
}

const trackingAreaSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }),
    startX: z.coerce.number().min(-4, { message: 'Start X must be >= -4' }).max(4, { message: 'Start X must be <= 4' }),
    startY: z.coerce.number().min(0, { message: 'Start Y must be >= 0' }).max(7, { message: 'Start Y must be <= 7' }),
    endX: z.coerce.number().min(-4, { message: 'End X must be >= -4' }).max(4, { message: 'End X must be <= 4' }),
    endY: z.coerce.number().min(0, { message: 'End Y must be >= 0' }).max(7, { message: 'End Y must be <= 7' }),
    description: z.string().optional().nullable()
}).refine((data) => data.startX < data.endX, {
    message: 'Start X must be less than End X',
    path: ['endX']
}).refine((data) => data.startY < data.endY, {
    message: 'Start Y must be less than End Y',
    path: ['endY']
});

const zoneSchema = z.object({
    zoneId: z.string().optional(), // For updates
    name: z.string().min(1, { message: 'Name is required' }),
    zoneNumber: z.coerce.number().int().min(1).max(10),
    startX: z.coerce.number().min(-4, { message: 'Start X must be >= -4' }).max(4, { message: 'Start X must be <= 4' }),
    startY: z.coerce.number().min(0, { message: 'Start Y must be >= 0' }).max(7, { message: 'Start Y must be <= 7' }),
    endX: z.coerce.number().min(-4, { message: 'End X must be >= -4' }).max(4, { message: 'End X must be <= 4' }),
    endY: z.coerce.number().min(0, { message: 'End Y must be >= 0' }).max(7, { message: 'End Y must be <= 7' }),
    description: z.string().optional().nullable(),
    color: z.string().optional().nullable()
}).refine((data) => data.startX < data.endX, {
    message: 'Start X must be less than End X',
    path: ['endX']
}).refine((data) => data.startY < data.endY, {
    message: 'Start Y must be less than End Y',
    path: ['endY']
});

const dwellBucketSchema = z.object({
    name: z.string().min(1, { message: 'Name is required' }),
    minDuration: z.coerce.number().int().min(0),
    maxDuration: z.coerce.number().int().min(0).optional().nullable(),
    description: z.string().optional().nullable(),
    color: z.string().optional().default('#10b981') // Default emerald color
});

// Helper to generate IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper to get sensor from controller ID
// The URL param [id] is the controller ID, not the sensor ID
async function getSensorFromControllerId(prisma: PrismaClient, controllerId: string | undefined) {
    if (!controllerId) {
        return { error: 'Controller ID is required', sensor: null };
    }
    
    const controller = await prisma.controller.findFirst({
        where: {
            id: controllerId,
            isDeleted: false
        },
        include: {
            sensors: {
                where: { type: 'radar' }
            }
        }
    });
    
    if (!controller) {
        return { error: 'Controller not found', sensor: null };
    }
    
    const sensor = controller.sensors[0];
    if (!sensor) {
        return { error: 'Radar sensor not found for this controller', sensor: null };
    }
    
    return { error: null, sensor };
}

export const load = restrict(
    async ({ params, locals }: AuthenticatedLoadEvent) => {
        const { id } = params; // This is the controller ID

        try {
            // First find the controller by ID (only non-deleted)
            const controller = await locals.prisma.controller.findFirst({
                where: {
                    id,
                    isDeleted: false // Only find non-deleted controllers
                },
                include: {
                    device: {
                        select: {
                            id: true,
                            name: true,
                            hardwareId: true,
                            connected: true,
                            accountId: true
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
                throw error(404, 'Controller not found');
            }

            // Get the radar sensor from the controller
            const sensor = controller.sensors.find((s: { type: string }) => s.type === 'radar');

            if (!sensor) {
                throw error(404, 'Radar sensor not found for this controller');
            }

            const config = (sensor.config as unknown as RadarConfig) || {};

            // Add controller reference to sensor object for compatibility
            const sensorWithController = {
                ...sensor,
                controller: {
                    ...controller,
                    device: controller.device
                }
            };

            // Get accounts - Admin can assign to any account including SYSTEM_ACCOUNT
            // Include current account (even if SYSTEM_ACCOUNT), all non-system accounts, and SYSTEM_ACCOUNT
            const deviceAccountId = controller.device?.accountId || sensor.accountId;

            const accounts = await locals.prisma.account.findMany({
                where: {
                    OR: [
                        { id: deviceAccountId }, // Always include current account (even if SYSTEM_ACCOUNT)
                        { isSystem: false }, // Include all non-system accounts
                        { name: 'SYSTEM_ACCOUNT' } // Always include SYSTEM_ACCOUNT for Admin
                    ]
                },
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
                    status: sensor.status as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE',
                    accountId: sensor.accountId,
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
            const dwellBucketForm = await superValidate(
                { color: '#10b981', minDuration: 0 }, // Provide defaults
                zod(dwellBucketSchema)
            );

            // Get devices for the dropdown - Admin can select from all accounts including SYSTEM_ACCOUNT
            // Show current device, all devices from non-system accounts, and devices from SYSTEM_ACCOUNT
            // When account is changed in UI, devices will be filtered client-side
            const devices = await locals.prisma.device.findMany({
                where: {
                    OR: [
                        { id: controller.deviceId }, // Always include current device
                        { 
                            account: {
                                isSystem: false // Include devices from all non-system accounts
                            }
                        },
                        {
                            account: {
                                name: 'SYSTEM_ACCOUNT' // Include devices from SYSTEM_ACCOUNT
                            }
                        }
                    ]
                },
                include: {
                    account: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    controllers: {
                        where: {
                            type: 'radar',
                            isDeleted: false
                        },
                        select: {
                            id: true
                        }
                    }
                },
                orderBy: {
                    name: 'asc'
                }
            });

            return {
                form,
                trackingAreaForm,
                zoneForm,
                dwellBucketForm,
                radarSensor: {
                    ...sensorWithController,
                    config // Explicitly pass typed config
                },
                accounts,
                devices
            };
        } catch (err: unknown) {
            if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
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
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const form = await superValidate(request, zod(radarSensorSchema));

            if (!form.valid) {
                return fail(400, { form });
            }

            try {
                // First find the controller to get the sensor
                const controller = await locals.prisma.controller.findFirst({
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
                const existingSensor = controller.sensors.find((s: { type: string }) => s.type === 'radar');

                if (!existingSensor) {
                    return fail(404, { error: 'Sensor not found' });
                }

                const sensorId = existingSensor.id;

                // Validate new device if changed
                if (form.data.deviceId && form.data.deviceId !== controller.deviceId) {
                    const newDevice = await locals.prisma.device.findUnique({
                        where: { id: form.data.deviceId },
                        include: {
                            controllers: {
                                where: {
                                    type: 'radar',
                                    isDeleted: false
                                }
                            }
                        }
                    });

                    if (!newDevice) {
                        return fail(400, { 
                            form, 
                            error: 'Selected device does not exist' 
                        });
                    }

                    // Validate device belongs to the selected account
                    if (newDevice.accountId !== form.data.accountId) {
                        return fail(400, { 
                            form, 
                            error: 'Selected device does not belong to the selected account' 
                        });
                    }

                    // Check if new device already has an active radar controller
                    if (newDevice.controllers.length > 0) {
                        const existingController = newDevice.controllers[0];
                        if (existingController.id !== controller.id) {
                            return fail(400, { 
                                form, 
                                error: 'Selected device already has an active radar controller. Only one active radar controller is allowed per device.' 
                            });
                        }
                    }
                }

                // Update sensor
                const sensor = await locals.prisma.sensor.update({
                    where: { id: sensorId },
                    data: {
                        name: form.data.name,
                        serialNumber: form.data.serialNumber,
                        description: form.data.description,
                        location: form.data.location,
                        firmware: form.data.firmware,
                        status: form.data.status,
                        accountId: form.data.accountId,
                    }
                });

                // Update controller device link if changed
                if (form.data.deviceId && form.data.deviceId !== controller.deviceId) {
                    await locals.prisma.controller.update({
                        where: { id: controller.id },
                        data: {
                            deviceId: form.data.deviceId,
                            accountId: form.data.accountId // Also update controller's accountId to match
                        }
                    });
                } else if (form.data.accountId !== controller.accountId) {
                    // If only account changed, update controller's accountId
                    await locals.prisma.controller.update({
                        where: { id: controller.id },
                        data: {
                            accountId: form.data.accountId
                    }
                });
                }

                logger.info(`Sensor updated: ${sensor.id}`);
                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Sensor',
                    recordId: sensor.id,
                    oldData: existingSensor,
                    newData: sensor,
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: locals.prisma
                });

                return { 
                    form,
                    type: 'success' as const
                };
            } catch (err) {
                logger.error(`Error updating sensor: ${err}`);
                return fail(500, { 
                    form, 
                    error: 'Failed to update sensor',
                    type: 'error' as const
                });
            }
        },
        [SystemRole.ADMIN]
    ),

    createTrackingArea: restrict(
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
            }

            try {
                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (config.trackingArea) {
                    return fail(400, { error: 'Tracking area already exists' });
                }

                // Validate and clamp bounds
                let bounds = normalizeBounds({
                    startX: form.data.startX,
                    startY: form.data.startY,
                    endX: form.data.endX,
                    endY: form.data.endY,
                });
                const validation = validateBounds(bounds);
                if (!validation.valid) {
                    return fail(400, { 
                        trackingAreaForm: form,
                        error: `Invalid bounds: ${validation.errors.join(', ')}`
                    });
                }
                bounds = clampBounds(bounds);

                config.trackingArea = {
                    id: generateId(),
                    name: form.data.name,
                    startX: bounds.startX,
                    startY: bounds.startY,
                    endX: bounds.endX,
                    endY: bounds.endY,
                    description: form.data.description || undefined
                };

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
                });

                logger.info(`Tracking Area defined for sensor ${sensor.id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error creating tracking area: ${err}`);
                return fail(500, { error: 'Failed to create tracking area' });
            }
        },
        [SystemRole.ADMIN]
    ),

    updateTrackingArea: restrict(
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
            }

            try {
                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (!config.trackingArea) {
                    return fail(404, { error: 'Tracking area not found' });
                }

                // Validate and clamp bounds
                let bounds = normalizeBounds({
                    startX: form.data.startX,
                    startY: form.data.startY,
                    endX: form.data.endX,
                    endY: form.data.endY,
                });
                const validation = validateBounds(bounds);
                if (!validation.valid) {
                    return fail(400, { 
                        trackingAreaForm: form,
                        error: `Invalid bounds: ${validation.errors.join(', ')}`
                    });
                }
                bounds = clampBounds(bounds);

                config.trackingArea = {
                    ...config.trackingArea,
                    name: form.data.name,
                    startX: bounds.startX,
                    startY: bounds.startY,
                    endX: bounds.endX,
                    endY: bounds.endY,
                    description: form.data.description || undefined
                };

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
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
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const form = await superValidate(request, zod(zoneSchema));

            if (!form.valid) {
                return fail(400, { zoneForm: form });
            }

            try {
                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (!config.trackingArea) {
                    return fail(400, { error: 'Please create a tracking area first' });
                }

                if (!config.zones) config.zones = [];
                if (config.zones.length >= 5) {
                    return fail(400, { error: 'Maximum 5 zones allowed' });
                }

                // Validate and clamp bounds
                let bounds = normalizeBounds({
                    startX: form.data.startX,
                    startY: form.data.startY,
                    endX: form.data.endX,
                    endY: form.data.endY,
                });
                const validation = validateBounds(bounds);
                if (!validation.valid) {
                    return fail(400, { 
                        zoneForm: form,
                        error: `Invalid zone bounds: ${validation.errors.join(', ')}`
                    });
                }
                bounds = clampBounds(bounds);

                config.zones.push({
                    id: generateId(),
                    name: form.data.name,
                    zoneNumber: form.data.zoneNumber,
                    startX: bounds.startX,
                    startY: bounds.startY,
                    endX: bounds.endX,
                    endY: bounds.endY,
                    description: form.data.description || undefined,
                    color: form.data.color || undefined
                });

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
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
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) return fail(400, { error: 'Zone ID is required' });

            try {
                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.zones) return fail(400, { error: 'No zones found' });

                config.zones = config.zones.filter(z => z.id !== zoneId);

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
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
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const form = await superValidate(request, zod(zoneSchema));

            if (!form.valid) return fail(400, { zoneForm: form });
            
            const zoneId = form.data.zoneId;
            if (!zoneId) return fail(400, { error: 'Zone ID is required' });

            try {
                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.zones) return fail(400, { error: 'No zones found' });

                const zoneIndex = config.zones.findIndex(z => z.id === zoneId);
                if (zoneIndex === -1) return fail(404, { error: 'Zone not found' });

                // Validate and clamp bounds
                let bounds = normalizeBounds({
                    startX: form.data.startX,
                    startY: form.data.startY,
                    endX: form.data.endX,
                    endY: form.data.endY,
                });
                const validation = validateBounds(bounds);
                if (!validation.valid) {
                    return fail(400, { 
                        zoneForm: form,
                        error: `Invalid zone bounds: ${validation.errors.join(', ')}`
                    });
                }
                bounds = clampBounds(bounds);

                config.zones[zoneIndex] = {
                    ...config.zones[zoneIndex],
                    name: form.data.name,
                    zoneNumber: form.data.zoneNumber,
                    startX: bounds.startX,
                    startY: bounds.startY,
                    endX: bounds.endX,
                    endY: bounds.endY,
                    description: form.data.description || undefined,
                    color: form.data.color || undefined
                };

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
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
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const formData = await request.formData();
            const layoutJson = formData.get('layout')?.toString();

            if (!layoutJson) return fail(400, { error: 'Layout data missing' });

            try {
                const layout = JSON.parse(layoutJson);
                const { arena, zones } = layout;

                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};

                type LayoutZone = {
                    id?: string;
                    name?: string;
                    zoneNumber?: number;
                    startX: number;
                    startY: number;
                    endX: number;
                    endY: number;
                    color?: string;
                    description?: string;
                };

                const MAX_ZONES = 5;
                const getZoneKey = (z: LayoutZone): string => {
                    if (typeof z.zoneNumber === 'number') return `num:${z.zoneNumber}`;
                    if (z.id) return `id:${z.id}`;
                    return `name:${z.name || ''}`;
                };
                const dedupeByKeyLastWins = (arr: LayoutZone[]): LayoutZone[] => {
                    const map = new Map<string, LayoutZone>();
                    for (const z of arr) map.set(getZoneKey(z), z);
                    return [...map.values()];
                };
                const dedupeConfigZonesByZoneNumber = (): void => {
                    if (!config.zones) return;
                    // Deduplicate by zoneNumber first (last wins), then by id/name fallback
                    const normalized: LayoutZone[] = config.zones.map((z) => ({
                        id: z.id,
                        name: z.name,
                        zoneNumber: z.zoneNumber,
                        startX: z.startX,
                        startY: z.startY,
                        endX: z.endX,
                        endY: z.endY,
                        color: z.color,
                        description: z.description
                    }));
                    const deduped = dedupeByKeyLastWins(normalized);
                    deduped.sort((a, b) => (a.zoneNumber ?? 999) - (b.zoneNumber ?? 999));
                    config.zones = deduped.slice(0, MAX_ZONES).map((z, idx) => ({
                        id: z.id || generateId(),
                        zoneNumber: typeof z.zoneNumber === 'number' ? z.zoneNumber : idx + 1,
                        name: z.name || `Zone ${typeof z.zoneNumber === 'number' ? z.zoneNumber : idx + 1}`,
                        startX: z.startX,
                        startY: z.startY,
                        endX: z.endX,
                        endY: z.endY,
                        color: z.color,
                        description: z.description
                    }));
                };

                // Update or Create Arena with validation
                if (arena) {
                    let bounds = normalizeBounds({
                        startX: arena.startX,
                        startY: arena.startY,
                        endX: arena.endX,
                        endY: arena.endY,
                    });
                    const validation = validateBounds(bounds);
                    if (!validation.valid) {
                        return fail(400, { 
                            error: `Invalid arena bounds: ${validation.errors.join(', ')}`
                        });
                    }
                    bounds = clampBounds(bounds);
                    
                    // Create tracking area if it doesn't exist
                    if (!config.trackingArea) {
                        config.trackingArea = {
                            id: generateId(),
                            name: `${sensor.name} Tracking Area`,
                            startX: bounds.startX,
                            startY: bounds.startY,
                            endX: bounds.endX,
                            endY: bounds.endY,
                            description: undefined
                        };
                        logger.info(`Tracking Area created for sensor ${sensor.id}`);
                    } else {
                        // Update existing tracking area
                        config.trackingArea.startX = bounds.startX;
                        config.trackingArea.startY = bounds.startY;
                        config.trackingArea.endX = bounds.endX;
                        config.trackingArea.endY = bounds.endY;
                    }
                }

                // Update or Create Zones with validation
                if (zones && Array.isArray(zones)) {
                    if (!config.zones) config.zones = [];
                    // Clean existing dirty data first (prevents UI weirdness if DB already has duplicates)
                    dedupeConfigZonesByZoneNumber();
                    
                    // Normalize + dedupe incoming zones (last-write-wins per zoneNumber/id/name)
                    const incomingZones = dedupeByKeyLastWins(zones as LayoutZone[]);
                    
                    const usedZoneNumbers = new Set<number>();
                    for (const z of config.zones) {
                        if (typeof z.zoneNumber === 'number') usedZoneNumbers.add(z.zoneNumber);
                    }
                    const nextFreeZoneNumber = (): number => {
                        for (let n = 1; n <= MAX_ZONES; n++) {
                            if (!usedZoneNumbers.has(n)) return n;
                        }
                        return Math.max(0, ...[...usedZoneNumbers]) + 1;
                    };
                    
                    const reconciledZones: Array<NonNullable<RadarConfig['zones']>[number]> = [];
                    
                    for (const z of incomingZones) {
                        // Validate bounds first
                        let bounds = normalizeBounds({
                            startX: z.startX,
                            startY: z.startY,
                            endX: z.endX,
                            endY: z.endY,
                        });
                        const validation = validateBounds(bounds);
                        if (!validation.valid) {
                            return fail(400, { 
                                error: `Invalid zone bounds for zone "${z.name}": ${validation.errors.join(', ')}`
                            });
                        }
                        bounds = clampBounds(bounds);
                        
                        // Match existing zone by id, else by zoneNumber, else by name
                        const existingZone =
                            (z.id ? config.zones.find(ez => ez.id === z.id) : null) ||
                            (typeof z.zoneNumber === 'number' ? config.zones.find(ez => ez.zoneNumber === z.zoneNumber) : null) ||
                            (z.name ? config.zones.find(ez => ez.name === z.name) : null);
                        
                        if (existingZone) {
                            // Update existing zone
                            existingZone.startX = bounds.startX;
                            existingZone.startY = bounds.startY;
                            existingZone.endX = bounds.endX;
                            existingZone.endY = bounds.endY;
                            if (z.name) existingZone.name = z.name;
                            if (z.color !== undefined) existingZone.color = z.color;
                            if (z.zoneNumber !== undefined) existingZone.zoneNumber = z.zoneNumber;
                            if (z.description !== undefined) existingZone.description = z.description;
                            
                            if (typeof existingZone.zoneNumber === 'number') usedZoneNumbers.add(existingZone.zoneNumber);
                            reconciledZones.push(existingZone);
                        } else {
                            // Create new zone
                            const assignedZoneNumber = typeof z.zoneNumber === 'number' ? z.zoneNumber : nextFreeZoneNumber();
                            usedZoneNumbers.add(assignedZoneNumber);
                            reconciledZones.push({
                                id: generateId(),
                                name: z.name || `Zone ${assignedZoneNumber}`,
                                zoneNumber: assignedZoneNumber,
                                startX: bounds.startX,
                                startY: bounds.startY,
                                endX: bounds.endX,
                                endY: bounds.endY,
                                color: z.color,
                                description: z.description
                            });
                        }
                    }
                    
                    // Source of truth: layout zones (after dedupe). Replace config.zones and cap.
                    reconciledZones.sort((a, b) => (a.zoneNumber ?? 999) - (b.zoneNumber ?? 999));
                    config.zones = reconciledZones.slice(0, MAX_ZONES);
                }

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
                });

                logger.info(`Layout saved for sensor ${sensor.id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error saving layout: ${err}`);
                return fail(500, { error: 'Failed to save layout' });
            }
        },
        [SystemRole.ADMIN]
    ),

    createDwellBucket: restrict(
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const form = await superValidate(request, zod(dwellBucketSchema));

            if (!form.valid) return fail(400, { dwellBucketForm: form });

            try {
                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.dwellBuckets) config.dwellBuckets = [];

                config.dwellBuckets.push({
                    id: generateId(),
                    name: form.data.name,
                    minDuration: form.data.minDuration,
                    maxDuration: form.data.maxDuration ?? undefined,
                    description: form.data.description || undefined
                });

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
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
        async ({ request, params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID
            const formData = await request.formData();
            const bucketId = formData.get('bucketId')?.toString();

            if (!bucketId) return fail(400, { error: 'Dwell Bucket ID is required' });

            try {
                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.dwellBuckets) return fail(400, { error: 'No dwell buckets found' });

                config.dwellBuckets = config.dwellBuckets.filter(b => b.id !== bucketId);

                await locals.prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: config as Prisma.InputJsonValue,
                        configVersion: sensor.configVersion + 1,
                        syncStatus: 'PENDING',
                        lastSyncError: null,
                        updatedAt: new Date()
                    }
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
        async ({ params, locals }: AuthenticatedLoadEvent) => {
            const { id } = params; // This is the controller ID

            try {
                // First find the controller by ID (only non-deleted)
                const controller = await locals.prisma.controller.findFirst({
                    where: {
                        id,
                        isDeleted: false // Only find non-deleted controllers
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

                // Start transaction - hard delete both sensor and controller
                const result = await locals.prisma.$transaction(async (tx) => {
                    // First delete the sensor
                    const deletedSensor = await tx.sensor.delete({
                        where: { id: sensor.id }
                    });

                    // Then hard delete the controller to free the serialNumber constraint
                    const deletedController = await tx.controller.delete({
                        where: { id: controller.id }
                });

                    return { sensor: deletedSensor, controller: deletedController };
                });

                logger.info(`Sensor deleted: ${result.sensor.id}, Controller deleted: ${result.controller.id}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Sensor',
                    recordId: result.sensor.id,
                    oldData: sensor,
                    newData: null,
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
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

