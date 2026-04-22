import { fail, error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
// TODO: Re-enable ACL (restrictModule for USER_CONTROLLERS_RADAR) later.
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import { validateBounds, clampBounds, normalizeBounds, RADAR_CONSTRAINTS } from '$lib/components/ui_components_sveltekit/radar/constraints';
import { sanitizeTriggerRulesFromPayload } from '$lib/server/radar/sanitizeTriggerRules';
import type { RadarTriggerRule } from '$lib/types/radarTriggerRule';
import type { PrismaClient, Prisma } from '@prisma/client';
// Raw Prisma for sensor.update: access is enforced by checkAccountAccess + restrictModule; ZenStack policy only allows account members 'read' on Sensor, so we use unenhanced client for config updates.
import prisma from '$lib/server/prisma';
import { syncRadarSensorNameWithLinkedDevice } from '$lib/server/device/radarDeviceNameSync';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';
import { isDeviceOnline } from '$lib/server/device/devicePresence'; // single-device, only one sensor on this page
import { isControllerOnline } from '$lib/server/device/controllerPresence';

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
    /** When false, zone is deactivated (not used for detection). Default true when omitted. */
    active?: boolean;
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

/** Alert rules and notification channels stored in Sensor.config.alertSettings */
export interface AlertSettings {
    sensorOffline?: { enabled: boolean; threshold: string; unit: string };
    noData?: { enabled: boolean; threshold: string; unit: string };
    dwellTime?: { enabled: boolean; zoneId: string; threshold: string };
    email?: { enabled: boolean; address: string };
    webhook?: { enabled: boolean; url: string };
}

interface RadarConfig {
    trackingArea?: TrackingArea;
    zones?: Zone[];
    dwellBuckets?: DwellBucket[];
    /** Custom webhook trigger rules (device / edge execution out of scope). */
    triggerRules?: RadarTriggerRule[];
    alertSettings?: AlertSettings;
    deviceMode?: string;
    timezone?: string;
    pathTracking?: boolean;
    dwellThreshold?: number;
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

const updateSensorInfoSchema = z.object({
    name: z.string().min(1, { message: 'Sensor name is required' }).max(50, { message: 'Name must be 50 characters or less' }),
    location: z.string().max(200, { message: 'Location must be 200 characters or less' }).optional().nullable()
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

export const load = restrict(
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
                            connected: true,
                            macAddress: true,
                            wifiMac: true,
                            lanMac: true
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
                // URL might contain sensor ID (e.g. from list fallback or bookmark); resolve to controller and redirect
                const sensorById = await locals.prisma.sensor.findFirst({
                    where: {
                        id,
                        type: 'radar',
                        accountId: currentAccountId,
                        controller: { isDeleted: false }
                    },
                    select: { controllerId: true }
                });
                if (sensorById?.controllerId) {
                    throw redirect(302, `/user/controllers/radar/${sensorById.controllerId}`);
                }
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

            // Enrich with Redis-backed presence so the UI shows real-time MQTT state on first paint.
            // Device-agent and controller bridge are tracked independently — see clientIdentity.ts.
            let deviceWithPresence = controller.device;
            if (controller.device?.id) {
                try {
                    const isOnline = await isDeviceOnline(controller.device.id);
                    deviceWithPresence = { ...controller.device, connected: isOnline };
                } catch (e) {
                    logger.warn(`[Radar] Failed to check device presence for ${controller.device.id}: ${e}`);
                }
            }

            let controllerBridgeOnline = (controller as { connected?: boolean }).connected ?? false;
            try {
                controllerBridgeOnline = await isControllerOnline(controller.id);
            } catch (e) {
                logger.warn(`[Radar] Failed to check controller presence for ${controller.id}: ${e}`);
            }

            const sensorWithController = {
                ...sensor,
                controller: {
                    ...controller,
                    connected: controllerBridgeOnline,
                    device: deviceWithPresence
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

            // Load template assignments for this sensor
            const templateAssignments = await locals.prisma.sensorTemplateAssignment.findMany({
                where: { sensorId: sensor.id },
                include: {
                    template: { select: { id: true, name: true, type: true } }
                }
            });
            const configTemplate = templateAssignments.find(a => a.template.type === 'CONFIGURATION');
            const alertTemplate = templateAssignments.find(a => a.template.type === 'ALERT');

            return {
                trackingAreaForm,
                zoneForm,
                dwellBucketForm,
                radarSensor: {
                    ...sensorWithController,
                    config
                },
                configTemplateName: configTemplate?.template?.name ?? null,
                alertTemplateName: alertTemplate?.template?.name ?? null,
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
    [SystemRole.USER, SystemRole.ADMIN]
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
    createTrackingArea: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
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

                await prisma.sensor.update({
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
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    updateTrackingArea: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
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

                await prisma.sensor.update({
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
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    createZone: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
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

                await prisma.sensor.update({
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
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    updateZone: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
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

                await prisma.sensor.update({
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
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    deleteZone: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
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

                config.zones = config.zones.filter((z) => (z.id ?? `zone-${z.zoneNumber}`) !== zoneId);

                await prisma.sensor.update({
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
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    setZoneActive: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const formData = await request.formData();
            const zoneId = formData.get('zoneId')?.toString();
            const activeRaw = formData.get('active')?.toString();

            if (!zoneId) return fail(400, { error: 'Zone ID is required' });
            const active = activeRaw === 'true';

            try {
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, id);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });

                const config = (sensor.config as unknown as RadarConfig) || {};
                if (!config.zones) return fail(400, { error: 'No zones found' });

                const zoneIndex = config.zones.findIndex(
                    (z) => (z.id ?? `zone-${z.zoneNumber}`) === zoneId
                );
                if (zoneIndex === -1) return fail(404, { error: 'Zone not found' });

                config.zones[zoneIndex] = { ...config.zones[zoneIndex], active };

                await prisma.sensor.update({
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
                logger.error(`Error setting zone active: ${err}`);
                return fail(500, { error: 'Failed to update zone status' });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    saveLayout: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
            const { id } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) {
                return fail(403, { error: 'User account not found' });
            }

            const formData = await request.formData();
            const layoutJson = formData.get('layout')?.toString();

            if (!layoutJson) return fail(400, { error: 'Layout data missing' });

            let layout: {
                arena?: { startX: number; startY: number; endX: number; endY: number } | null;
                zones?: unknown[];
                triggerRules?: unknown;
            };
            try {
                layout = JSON.parse(layoutJson) as typeof layout;
            } catch (_e) {
                return fail(400, { error: 'Invalid layout JSON' });
            }
            const { arena, zones, triggerRules: triggerRulesPayload } = layout;

            try {
                if (!currentAccountId) {
                    return fail(403, { error: 'User account not found' });
                }
                await checkAccountAccess(id, currentAccountId as string, locals.prisma);

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
                    /** When false, zone is deactivated. Preserved on save. */
                    active?: boolean;
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
                        description: z.description,
                        active: z.active
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
                        description: z.description,
                        active: z.active
                    }));
                };

                // Update or Create Arena with validation
                if (arena) {
                    const ax = Number(arena.startX);
                    const ay = Number(arena.startY);
                    const aex = Number(arena.endX);
                    const aey = Number(arena.endY);
                    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(aex) || !Number.isFinite(aey)) {
                        return fail(400, { error: 'Invalid arena coordinates (must be numbers)' });
                    }
                    let bounds = normalizeBounds({
                        startX: ax,
                        startY: ay,
                        endX: aex,
                        endY: aey,
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
                            name: `${sensor.name ?? 'Radar'} Tracking Area`,
                            startX: bounds.startX,
                            startY: bounds.startY,
                            endX: bounds.endX,
                            endY: bounds.endY
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
                        // Validate bounds first (coerce to number)
                        const zx = Number(z.startX);
                        const zy = Number(z.startY);
                        const zex = Number(z.endX);
                        const zey = Number(z.endY);
                        if (!Number.isFinite(zx) || !Number.isFinite(zy) || !Number.isFinite(zex) || !Number.isFinite(zey)) {
                            return fail(400, { error: `Invalid zone "${z.name ?? 'unknown'}": coordinates must be numbers` });
                        }
                        let bounds = normalizeBounds({
                            startX: zx,
                            startY: zy,
                            endX: zex,
                            endY: zey,
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
                            if (z.active !== undefined) existingZone.active = z.active;
                            
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
                                description: z.description,
                                active: z.active !== false
                            });
                        }
                    }
                    
                    // Source of truth: layout zones (after dedupe). Replace config.zones and cap.
                    reconciledZones.sort((a, b) => (a.zoneNumber ?? 999) - (b.zoneNumber ?? 999));
                    config.zones = reconciledZones.slice(0, MAX_ZONES);
                }

                if (triggerRulesPayload !== undefined) {
                    const allowedTracking = new Set<string>(['entire']);
                    for (const z of config.zones ?? []) {
                        if (z.id) allowedTracking.add(z.id);
                        if (typeof z.zoneNumber === 'number') allowedTracking.add(`zone-${z.zoneNumber}`);
                    }
                    const tr = sanitizeTriggerRulesFromPayload(triggerRulesPayload, allowedTracking);
                    if (!tr.ok) {
                        return fail(400, { error: tr.error });
                    }
                    config.triggerRules = tr.rules;
                }

                // Sanitize config: strip undefined so Prisma Json accepts it
                const configForDb = JSON.parse(JSON.stringify(config)) as Prisma.InputJsonValue;
                const configVersionNext = (sensor.configVersion ?? 0) + 1;

                await prisma.sensor.update({
                    where: { id: sensor.id },
                    data: { 
                        config: configForDb,
                        configVersion: configVersionNext,
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
                const errMessage = err instanceof Error ? err.message : String(err);
                const errStack = err instanceof Error ? err.stack : '';
                logger.error(`Error saving layout: ${errMessage}${errStack ? `. Stack: ${errStack}` : ''}`);
                return fail(500, { error: 'Failed to save layout' });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    createDwellBucket: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
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

                await prisma.sensor.update({
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
        [SystemRole.USER, SystemRole.ADMIN]
    ),

    deleteDwellBucket: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
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

                await prisma.sensor.update({
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
        [SystemRole.USER, SystemRole.ADMIN]
    ),
    updateSensorInfo: restrict(
        async ({ request, params, locals, cookies }: AuthenticatedEvent) => {
            const { id: controllerId } = params;
            const currentAccountId = cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
            if (!currentAccountId) return fail(403, { error: 'User account not found' });
            const form = await superValidate(request, zod(updateSensorInfoSchema));
            if (!form.valid) return fail(400, { updateSensorInfo: form });
            try {
                await checkAccountAccess(controllerId, currentAccountId as string, locals.prisma);
                const { error: sensorError, sensor } = await getSensorFromControllerId(locals.prisma, controllerId);
                if (sensorError || !sensor) return fail(404, { error: sensorError || 'Sensor not found' });
                const ok = await syncRadarSensorNameWithLinkedDevice(prisma, {
                    sensorId: sensor.id,
                    name: form.data.name,
                    location: form.data.location ?? null,
                    accountId: currentAccountId as string
                });
                if (!ok) return fail(404, { error: 'Sensor not found' });
                return { success: true };
            } catch (err: unknown) {
                if (err && typeof err === 'object' && 'status' in err && (err.status === 403 || err.status === 404)) throw err;
                logger.error('Error updating sensor info:', err);
                return fail(500, { error: 'Failed to update sensor. Please try again.' });
            }
        },
        [SystemRole.USER, SystemRole.ADMIN]
    ),
};


