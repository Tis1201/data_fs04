import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma';
import type { Prisma } from '@prisma/client';
import { logger } from '$lib/server/logger';
import { getBulkDeviceInformationByDeviceIds } from '$lib/server/clickhouse/client';
import { areControllersOnline } from '$lib/server/device/controllerPresence';
import { computeDeviceListLastPingAt } from '$lib/utils/deviceDetailsUtils';

// Define enum locally to avoid Vite ESM/CJS issues with @prisma/client
const SensorTemplateType = {
    CONFIGURATION: 'CONFIGURATION',
    ALERT: 'ALERT'
} as const;
type SensorTemplateType = (typeof SensorTemplateType)[keyof typeof SensorTemplateType];

/** Alert settings (for Alert template type). */
export interface TemplateAlertSettings {
    sensorOffline?: { enabled: boolean; threshold?: string; unit?: string };
    noData?: { enabled: boolean; threshold?: string; unit?: string };
    dwellTime?: { enabled: boolean; zoneId?: string; threshold?: string };
    email?: { enabled: boolean; address?: string };
    webhook?: { enabled: boolean; url?: string };
}

/**
 * Template config shape (mirrors radar sensor config: tracking area + zones + device settings; alertSettings for Alert type).
 */
export interface TemplateConfig {
    trackingArea?: {
        xMin: number;
        xMax: number;
        yMin: number;
        yMax: number;
        // Also support startX/endX format for backward compatibility
        startX?: number;
        startY?: number;
        endX?: number;
        endY?: number;
    };
    zones?: Array<{
        id?: string;
        name: string;
        zoneNumber?: number;
        startX?: number;
        startY?: number;
        endX?: number;
        endY?: number;
        xMin?: number;
        xMax?: number;
        yMin?: number;
        yMax?: number;
        color?: string;
        active?: boolean;
    }>;
    deviceSettings?: {
        deviceMode?: string;
        timezone?: string;
        pathTracking?: boolean;
        dataReportingInterval?: number;
        dwellThreshold?: number;
    };
    alertSettings?: TemplateAlertSettings;
}

export interface TemplateDetail {
    id: string;
    name: string;
    type: 'Alert' | 'Configuration';
    description: string | null;
    isDefault: boolean;
    createdBy: string;
    createdAt: string;
    updatedBy: string;
    updatedAt: string;
    config: TemplateConfig | null;
}

/** Row for Assigned Sensor table. */
export interface AssignedSensorRow {
    id: string;
    /** Radar detail URL uses controller id when present (same as radar list). */
    controllerId: string;
    name: string;
    serialNumber: string;
    macAddress: string;
    /** Bridge MQTT session: same rule as `/user/controllers/radar` Connection column (Redis + `Controller.connected`). */
    connection: string;
    /** ISO timestamp; same “last ping” rule as `/user/iot/devices` and radar list. */
    deviceLastPingAt: string | null;
    /** Sensor row timestamps — radar list Last ping column falls back: deviceLastPingAt ?? updatedAt ?? createdAt. */
    updatedAt: string;
    createdAt: string;
}

// Helper to get current account ID from cookies or locals
function getCurrentAccountId(cookies: { get: (name: string) => string | undefined }, locals: App.Locals): string | undefined {
    return cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
}

// Helper to map database type to display type
function mapTemplateType(type: SensorTemplateType): 'Alert' | 'Configuration' {
    return type === SensorTemplateType.ALERT ? 'Alert' : 'Configuration';
}

function displayDeviceMac(device: {
    macAddress: string | null;
    lanMac: string | null;
    wifiMac: string | null;
} | null | undefined): string {
    if (!device) return '—';
    const v = device.macAddress?.trim() || device.lanMac?.trim() || device.wifiMac?.trim();
    return v || '—';
}

export const load = restrict(
    async ({ params, url, depends, locals, cookies }: AuthenticatedLoadEvent) => {
        depends('app:userTemplates');

        const id = params?.id ?? '';
        if (!id) {
            throw error(404, 'Template not found');
        }

        const accountId = getCurrentAccountId(cookies, locals);
        if (!accountId) {
            throw error(403, 'No account found');
        }

        // Fetch template from database
        const dbTemplate = await prisma.sensorTemplate.findFirst({
            where: { id, accountId },
            include: {
                creator: {
                    select: { id: true, name: true, email: true }
                }
            }
        });

        if (!dbTemplate) {
            throw error(404, 'Template not found');
        }

        // Map to TemplateDetail
        const creatorName = dbTemplate.creator?.name || dbTemplate.creator?.email || '—';
        const template: TemplateDetail = {
            id: dbTemplate.id,
            name: dbTemplate.name,
            type: mapTemplateType(dbTemplate.type as SensorTemplateType),
            description: dbTemplate.description,
            isDefault: dbTemplate.isDefault,
            createdBy: creatorName,
            createdAt: dbTemplate.createdAt.toISOString(),
            updatedBy: creatorName, // For now, use creator as updater (can add updatedBy field later)
            updatedAt: dbTemplate.updatedAt.toISOString(),
            config: dbTemplate.config as TemplateConfig | null
        };

        // Pagination for assigned sensors
        const assignedPage = Math.max(1, parseInt(url.searchParams.get('assigned_page') || '1', 10));
        const assignedPerPage = 10;

        // Count total assigned sensors
        const assignedTotal = await prisma.sensorTemplateAssignment.count({
            where: { templateId: id }
        });

        // Fetch assigned sensors with pagination
        const assignments = await prisma.sensorTemplateAssignment.findMany({
            where: { templateId: id },
            skip: (assignedPage - 1) * assignedPerPage,
            take: assignedPerPage,
            include: {
                sensor: {
                    select: {
                        id: true,
                        name: true,
                        serialNumber: true,
                        status: true,
                        updatedAt: true,
                        createdAt: true,
                        controller: {
                            select: {
                                id: true,
                                connected: true,
                                device: {
                                    select: {
                                        id: true,
                                        macAddress: true,
                                        lanMac: true,
                                        wifiMac: true,
                                        lastUsedAt: true,
                                        connectedAt: true,
                                        disconnectedAt: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        const deviceIds = [
            ...new Set(
                assignments
                    .map((a) => a.sensor.controller?.device?.id)
                    .filter((id): id is string => !!id)
            )
        ];
        const chByDeviceId =
            deviceIds.length > 0
                ? await getBulkDeviceInformationByDeviceIds(deviceIds).catch((err) => {
                      logger.warn(`[Template ${id}] ClickHouse bulk device info failed: ${err}`);
                      return new Map<string, { last_connected_at?: string | null; last_status_at?: string | null }>();
                  })
                : new Map<string, { last_connected_at?: string | null; last_status_at?: string | null }>();

        const controllerIds = [
            ...new Set(
                assignments.map((a) => a.sensor.controller?.id).filter((cid): cid is string => !!cid)
            )
        ];
        let controllerPresenceMap = new Map<string, boolean>();
        try {
            controllerPresenceMap = await areControllersOnline(controllerIds);
        } catch (e) {
            logger.warn(`[Template ${id}] Batch controller (bridge) presence failed: ${e}`);
        }

        const assignedSensors: AssignedSensorRow[] = assignments.map((a) => {
            const s = a.sensor;
            const d = s.controller?.device;
            const ch = d?.id ? chByDeviceId.get(d.id) : undefined;
            const lastPing = d
                ? computeDeviceListLastPingAt(
                      {
                          lastUsedAt: d.lastUsedAt,
                          connectedAt: d.connectedAt,
                          disconnectedAt: d.disconnectedAt
                      },
                      ch
                  )
                : undefined;
            const cid = s.controller?.id;
            const dbBridge = s.controller?.connected === true;
            const bridgeOnline = cid ? (controllerPresenceMap.get(cid) ?? dbBridge) : false;
            return {
                id: s.id,
                controllerId: s.controller?.id ?? s.id,
                name: s.name,
                serialNumber: s.serialNumber,
                macAddress: displayDeviceMac(d),
                connection: bridgeOnline ? 'Online' : 'Offline',
                deviceLastPingAt: lastPing ? lastPing.toISOString() : null,
                updatedAt: s.updatedAt.toISOString(),
                createdAt: s.createdAt.toISOString()
            };
        });

        // Fetch all sensors for the account (for edit modal)
        const allSensors = await prisma.sensor.findMany({
            where: { accountId },
            select: {
                id: true,
                name: true,
                serialNumber: true
            },
            orderBy: { name: 'asc' }
        });

        // Map to available sensors format
        const availableSensors = allSensors.map(s => ({
            id: s.id,
            name: s.name,
            mac: s.serialNumber || undefined
        }));

        // Fetch all template names for duplicate validation (excluding current template)
        const allTemplates = await prisma.sensorTemplate.findMany({
            where: { accountId, id: { not: id } },
            select: { name: true }
        });
        const existingTemplateNames = allTemplates.map(t => t.name);

        return {
            template,
            assignedSensors,
            availableSensors,
            existingTemplateNames,
            assignedPagination: {
                page: assignedPage,
                per_page: assignedPerPage,
                total_records: assignedTotal,
                total_pages: Math.max(1, Math.ceil(assignedTotal / assignedPerPage))
            }
        };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

export const actions: Actions = {
    update: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            const name = form.get('name') as string | null;
            const description = form.get('description') as string | null;
            const trackingArea = form.get('trackingArea') as string | null;
            const zones = form.get('zones') as string | null;
            const deviceSettings = form.get('deviceSettings') as string | null;
            const selectedSensors = form.get('selectedSensors') as string | null;
            const alertSettingsRaw = form.get('alertSettings') as string | null;

            if (!id) return { success: false, error: 'Missing template id' };
            if (!name?.trim()) return { success: false, error: 'Template name is required' };
            if (name.length > 50) return { success: false, error: 'Template name must be 50 characters or less' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            const user = locals.user;

            // Parse JSON fields
            const parsedTrackingArea = trackingArea ? JSON.parse(trackingArea) : null;
            const parsedZones = zones ? JSON.parse(zones) : [];
            const parsedDeviceSettings = deviceSettings ? JSON.parse(deviceSettings) : null;
            const parsedSelectedSensors = selectedSensors ? JSON.parse(selectedSensors) : [];
            const parsedAlertSettings =
                alertSettingsRaw && typeof alertSettingsRaw === 'string' && alertSettingsRaw.trim().startsWith('{')
                    ? (JSON.parse(alertSettingsRaw) as TemplateAlertSettings)
                    : undefined;

            // Build config object (include alertSettings for Alert templates)
            const config: TemplateConfig = {
                trackingArea: parsedTrackingArea,
                zones: parsedZones,
                deviceSettings: parsedDeviceSettings
            };
            if (parsedAlertSettings != null) {
                config.alertSettings = parsedAlertSettings;
            }

            try {
                // Verify template belongs to user's account
                const existingTemplate = await prisma.sensorTemplate.findFirst({
                    where: { id, accountId }
                });

                if (!existingTemplate) {
                    return { success: false, error: 'Template not found' };
                }

                // Check for duplicate template name (case-insensitive, excluding current template)
                const duplicateName = await prisma.sensorTemplate.findFirst({
                    where: {
                        accountId,
                        id: { not: id },
                        name: { equals: name.trim(), mode: 'insensitive' }
                    },
                    select: { id: true }
                });
                if (duplicateName) {
                    return { success: false, error: 'Template name already exists' };
                }

                // Update template in database
                await prisma.sensorTemplate.update({
                    where: { id },
                    data: {
                        name: name.trim(),
                        description: description?.trim() || null,
                        config: config as Prisma.InputJsonValue
                    }
                });

                // Update sensor assignments
                // Remove all existing assignments, then recreate
                await prisma.sensorTemplateAssignment.deleteMany({
                    where: { templateId: id }
                });

                const allSensorIds = (parsedSelectedSensors as { id: string }[]).map(s => s.id);

                if (allSensorIds.length > 0) {
                    await prisma.sensorTemplateAssignment.createMany({
                        data: allSensorIds.map((sensorId: string) => ({
                            templateId: id,
                            sensorId,
                            assignedBy: user?.id
                        }))
                    });

                    // Apply template config to ALL assigned sensors (propagate updates)
                    const templateConfig = (config as Record<string, unknown>) || {};
                    for (const sensorId of allSensorIds) {
                        const sensor = await prisma.sensor.findFirst({
                            where: { id: sensorId, accountId },
                            select: { config: true, configVersion: true }
                        });
                        if (!sensor) continue;
                        const existingConfig = typeof sensor.config === 'object' && sensor.config !== null
                            ? (sensor.config as Record<string, unknown>)
                            : {};

                        // Flatten deviceSettings to top-level so sensor detail page can read them
                        const ds = templateConfig.deviceSettings as Record<string, unknown> | undefined;
                        const flatDeviceSettings: Record<string, unknown> = {};
                        if (ds) {
                            if (ds.deviceMode !== undefined) flatDeviceSettings.deviceMode = ds.deviceMode;
                            if (ds.timezone !== undefined) flatDeviceSettings.timezone = ds.timezone;
                            if (ds.pathTracking !== undefined) flatDeviceSettings.pathTracking = ds.pathTracking;
                            if (ds.dwellThreshold !== undefined) flatDeviceSettings.dwellThreshold = ds.dwellThreshold;
                        }

                        const merged = {
                            ...existingConfig,
                            ...templateConfig,
                            ...flatDeviceSettings
                        };

                        await prisma.sensor.update({
                            where: { id: sensorId, accountId },
                            data: {
                                config: merged as Prisma.InputJsonValue,
                                configVersion: sensor.configVersion + 1,
                                syncStatus: 'PENDING'
                            }
                        });
                    }
                }

                return { success: true };
            } catch (err) {
                console.error('Failed to update template:', err);
                return { success: false, error: 'Failed to update template' };
            }
        },
        [SystemRole.USER]
    ),
    saveConfig: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            const trackingArea = form.get('trackingArea') as string | null;
            const zones = form.get('zones') as string | null;

            if (!id) return { success: false, error: 'Missing template id' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            // Parse JSON fields
            const parsedTrackingArea = trackingArea ? JSON.parse(trackingArea) : null;
            const parsedZones = zones ? JSON.parse(zones) : [];

            try {
                // Verify template belongs to user's account
                const existingTemplate = await prisma.sensorTemplate.findFirst({
                    where: { id, accountId }
                });

                if (!existingTemplate) {
                    return { success: false, error: 'Template not found' };
                }

                // Get existing config and merge with new tracking area and zones
                const existingConfig = (existingTemplate.config as Record<string, unknown>) || {};
                const newConfig = {
                    ...existingConfig,
                    trackingArea: parsedTrackingArea,
                    zones: parsedZones
                };

                // Update template config in database
                await prisma.sensorTemplate.update({
                    where: { id },
                    data: {
                        config: newConfig
                    }
                });

                // Propagate config changes to all assigned sensors
                const assignments = await prisma.sensorTemplateAssignment.findMany({
                    where: { templateId: id },
                    select: { sensorId: true }
                });
                if (assignments.length > 0) {
                    const templateConfig = newConfig as Record<string, unknown>;
                    const ds = templateConfig.deviceSettings as Record<string, unknown> | undefined;
                    const flatDeviceSettings: Record<string, unknown> = {};
                    if (ds) {
                        if (ds.deviceMode !== undefined) flatDeviceSettings.deviceMode = ds.deviceMode;
                        if (ds.timezone !== undefined) flatDeviceSettings.timezone = ds.timezone;
                        if (ds.pathTracking !== undefined) flatDeviceSettings.pathTracking = ds.pathTracking;
                        if (ds.dwellThreshold !== undefined) flatDeviceSettings.dwellThreshold = ds.dwellThreshold;
                    }
                    for (const a of assignments) {
                        const sensor = await prisma.sensor.findFirst({
                            where: { id: a.sensorId, accountId },
                            select: { config: true, configVersion: true }
                        });
                        if (!sensor) continue;
                        const sConfig = typeof sensor.config === 'object' && sensor.config !== null
                            ? (sensor.config as Record<string, unknown>)
                            : {};
                        const merged = { ...sConfig, ...templateConfig, ...flatDeviceSettings };
                        await prisma.sensor.update({
                            where: { id: a.sensorId, accountId },
                            data: {
                                config: merged as Prisma.InputJsonValue,
                                configVersion: sensor.configVersion + 1,
                                syncStatus: 'PENDING'
                            }
                        });
                    }
                }

                return { success: true };
            } catch (err) {
                console.error('Failed to save template config:', err);
                return { success: false, error: 'Failed to save configuration' };
            }
        },
        [SystemRole.USER]
    ),
    removeSensor: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const sensorId = form.get('sensorId') as string | null;
            const templateId = form.get('templateId') as string | null;
            if (!sensorId || !templateId) return { success: false, error: 'Missing sensor or template id' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            try {
                // Verify template belongs to user's account
                const template = await prisma.sensorTemplate.findFirst({
                    where: { id: templateId, accountId }
                });

                if (!template) {
                    return { success: false, error: 'Template not found' };
                }

                // Delete the assignment
                await prisma.sensorTemplateAssignment.deleteMany({
                    where: { templateId, sensorId }
                });

                return { success: true };
            } catch (err) {
                console.error('Failed to remove sensor from template:', err);
                return { success: false, error: 'Failed to remove sensor' };
            }
        },
        [SystemRole.USER]
    )
};
