import { fail, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import { validateBounds, clampBounds, normalizeBounds, RADAR_CONSTRAINTS } from '$lib/components/ui_components_sveltekit/radar/constraints';
import type { PrismaClient, Prisma } from '@prisma/client';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

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
    startX: z.coerce.number().min(RADAR_CONSTRAINTS.X_MIN, { message: `Start X must be >= ${RADAR_CONSTRAINTS.X_MIN}` })
        .max(RADAR_CONSTRAINTS.X_MAX, { message: `Start X must be <= ${RADAR_CONSTRAINTS.X_MAX}` }),
    startY: z.coerce.number().min(RADAR_CONSTRAINTS.Y_MIN, { message: `Start Y must be >= ${RADAR_CONSTRAINTS.Y_MIN}` })
        .max(RADAR_CONSTRAINTS.Y_MAX, { message: `Start Y must be <= ${RADAR_CONSTRAINTS.Y_MAX}` }),
    endX: z.coerce.number().min(RADAR_CONSTRAINTS.X_MIN, { message: `End X must be >= ${RADAR_CONSTRAINTS.X_MIN}` })
        .max(RADAR_CONSTRAINTS.X_MAX, { message: `End X must be <= ${RADAR_CONSTRAINTS.X_MAX}` }),
    endY: z.coerce.number().min(RADAR_CONSTRAINTS.Y_MIN, { message: `End Y must be >= ${RADAR_CONSTRAINTS.Y_MIN}` })
        .max(RADAR_CONSTRAINTS.Y_MAX, { message: `End Y must be <= ${RADAR_CONSTRAINTS.Y_MAX}` }),
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
    startX: z.coerce.number().min(RADAR_CONSTRAINTS.X_MIN, { message: `Start X must be >= ${RADAR_CONSTRAINTS.X_MIN}` })
        .max(RADAR_CONSTRAINTS.X_MAX, { message: `Start X must be <= ${RADAR_CONSTRAINTS.X_MAX}` }),
    startY: z.coerce.number().min(RADAR_CONSTRAINTS.Y_MIN, { message: `Start Y must be >= ${RADAR_CONSTRAINTS.Y_MIN}` })
        .max(RADAR_CONSTRAINTS.Y_MAX, { message: `Start Y must be <= ${RADAR_CONSTRAINTS.Y_MAX}` }),
    endX: z.coerce.number().min(RADAR_CONSTRAINTS.X_MIN, { message: `End X must be >= ${RADAR_CONSTRAINTS.X_MIN}` })
        .max(RADAR_CONSTRAINTS.X_MAX, { message: `End X must be <= ${RADAR_CONSTRAINTS.X_MAX}` }),
    endY: z.coerce.number().min(RADAR_CONSTRAINTS.Y_MIN, { message: `End Y must be >= ${RADAR_CONSTRAINTS.Y_MIN}` })
        .max(RADAR_CONSTRAINTS.Y_MAX, { message: `End Y must be <= ${RADAR_CONSTRAINTS.Y_MAX}` }),
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

export const load = restrictModule(
    async ({ params, locals, cookies }: AuthenticatedLoadEvent) => {
        const { id } = params; // This is the controller ID

        // Get current account ID from cookie or locals
        const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
        if (!currentAccountId) {
            throw error(403, 'User account not found');
        }

        try {
            // First find the controller by ID (only non-deleted)
            const controller = await locals.prisma.controller.findFirst({
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
                });
            }

            // Get the radar sensor from the controller
            const sensor = controller.sensors.find((s: { type: string }) => s.type === 'radar');

            if (!sensor) {
                throw error(404, {
                    message: 'Radar sensor not found for this controller',
                });
            }

            // Check account access - user can only access their own account's controllers
            if (sensor.accountId !== currentAccountId) {
                throw error(403, {
                    message: 'Access denied',
                });
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

            // Get module permissions for frontend
            let modulePermissions = (locals as any).modulePermissions || {};
            if (Object.keys(modulePermissions).length === 0 && currentAccountId && locals.user?.id) {
                try {
                    modulePermissions = await getUserModulePermissions(locals.user.id, currentAccountId);
                } catch (e) { /* ignore */ }
            }

            return {
                trackingAreaForm,
                zoneForm,
                dwellBucketForm,
                radarSensor: {
                    ...sensorWithController,
                    config
                },
                modulePermissions,
                user: locals.user
            };
        } catch (err: unknown) {
            if (err && typeof err === 'object' && 'status' in err && (err.status === 404 || err.status === 403)) {
                throw err;
            }
            logger.error(`Error loading sensor: ${err}`);
            throw error(500, 'Failed to load sensor details');
        }
    },
    'USER_CONTROLLERS_RADAR',
    { action: 'VIEW' }
) satisfies PageServerLoad;

// Helper function to check account access using controller ID
async function checkAccountAccess(
    controllerId: string | undefined, 
    userAccountId: string | undefined, 
    prisma: AuthenticatedLoadEvent['locals']['prisma']
): Promise<void> {
    if (!controllerId || !userAccountId) {
        throw error(403, 'User account not found');
    }
    
    // Find controller and its radar sensor
    const controller = await prisma.controller.findFirst({
        where: {
            id: controllerId,
            isDeleted: false
        },
        include: {
            sensors: {
                where: { type: 'radar' },
                select: { accountId: true }
            }
        }
    });

    if (!controller) {
        throw error(404, 'Controller not found');
    }

    const sensor = controller.sensors[0];
    if (!sensor) {
        throw error(404, 'Radar sensor not found for this controller');
    }

    if (sensor.accountId !== userAccountId) {
        throw error(403, 'Access denied');
    }
}

export const actions: Actions = {
    createTrackingArea: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
            }

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

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

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (config.trackingArea) {
                    return fail(400, { error: 'Tracking area already exists' });
                }

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

                logger.info(`Tracking Area defined for sensor ${id}`);
                return { success: true };
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error creating tracking area: ${err}`);
                return fail(500, { error: 'Failed to create tracking area' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),

    updateTrackingArea: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const form = await superValidate(request, zod(trackingAreaSchema));

            if (!form.valid) {
                return fail(400, { trackingAreaForm: form });
            }

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

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

                const config = (sensor.config as unknown as RadarConfig) || {};

                if (!config.trackingArea) {
                    return fail(404, { error: 'Tracking area not found' });
                }

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
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error updating tracking area: ${err}`);
                return fail(500, { error: 'Failed to update tracking area' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),

    createZone: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const form = await superValidate(request, zod(zoneSchema));

            if (!form.valid) {
                return fail(400, { zoneForm: form });
            }

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

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
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error creating zone: ${err}`);
                return fail(500, { error: 'Failed to create zone' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),

    updateZone: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const form = await superValidate(request, zod(zoneSchema));
            
            if (!form.valid) return fail(400, { zoneForm: form });
            
            const zoneId = form.data.zoneId;
            if (!zoneId) return fail(400, { error: 'Zone ID is required' });

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

                // Get sensor from controller ID
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

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

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.zones) return fail(400, { error: 'No zones found' });

                const zoneIndex = config.zones.findIndex(z => z.id === zoneId);
                if (zoneIndex === -1) return fail(404, { error: 'Zone not found' });

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
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error updating zone: ${err}`);
                return fail(500, { error: 'Failed to update zone' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),

    deleteZone: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();

            if (!zoneId) return fail(400, { error: 'Zone ID is required' });

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

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
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error deleting zone: ${err}`);
                return fail(500, { error: 'Failed to delete zone' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),

    saveLayout: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const formData = await request.formData();
            const layoutJson = formData.get('layout')?.toString();

            if (!layoutJson) return fail(400, { error: 'Layout data missing' });

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

                const layout = JSON.parse(layoutJson);
                const { arena, zones } = layout;

                // Get sensor from controller ID (id is controller ID, not sensor ID)
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
                    // Clean existing dirty data first (prevents DB duplicates from persisting)
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

                logger.info(`Layout saved for sensor ${id}`);
                return { success: true };
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error saving layout: ${err}`);
                return fail(500, { error: 'Failed to save layout' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),

    createDwellBucket: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const form = await superValidate(request, zod(dwellBucketSchema));

            if (!form.valid) return fail(400, { dwellBucketForm: form });

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

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
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error creating dwell bucket: ${err}`);
                return fail(500, { error: 'Failed to create dwell bucket' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),

    deleteDwellBucket: restrictModule(
        async ({ request, params, locals, cookies }: ModuleAuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const formData = await request.formData();
            const bucketId = formData.get('bucketId')?.toString();

            if (!bucketId) return fail(400, { error: 'Dwell Bucket ID is required' });

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

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
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) {
                    throw err;
                }
                logger.error(`Error deleting dwell bucket: ${err}`);
                return fail(500, { error: 'Failed to delete dwell bucket' });
            }
        },
        'USER_CONTROLLERS_RADAR',
        { action: 'EDIT' }
    ),
};


