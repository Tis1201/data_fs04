import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma';
import type { Prisma } from '@prisma/client';

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
    name: string;
    serialNumber: string;
    location: string;
    status: string;
    lastSeen: string;
}

// Helper to get current account ID from cookies or locals
function getCurrentAccountId(cookies: { get: (name: string) => string | undefined }, locals: App.Locals): string | undefined {
    return cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
}

// Helper to map database type to display type
function mapTemplateType(type: SensorTemplateType): 'Alert' | 'Configuration' {
    return type === SensorTemplateType.ALERT ? 'Alert' : 'Configuration';
}

// Helper to format relative time
function formatRelativeTime(date: Date | null): string {
    if (!date) return '—';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
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
                        location: true,
                        status: true,
                        updatedAt: true
                    }
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        // Map to AssignedSensorRow
        const assignedSensors: AssignedSensorRow[] = assignments.map(a => ({
            id: a.sensor.id,
            name: a.sensor.name,
            serialNumber: a.sensor.serialNumber,
            location: a.sensor.location || '—',
            status: a.sensor.status === 'ACTIVE' ? 'Online' : 'Offline',
            lastSeen: formatRelativeTime(a.sensor.updatedAt)
        }));

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

        return {
            template,
            assignedSensors,
            availableSensors,
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
                // Determine which sensors are NEWLY assigned vs already assigned.
                // Only newly assigned sensors get template config applied (a:1 → a:2).
                // Already-assigned sensors keep their own config (a:3 stays a:3).
                const existingAssignments = await prisma.sensorTemplateAssignment.findMany({
                    where: { templateId: id },
                    select: { sensorId: true }
                });
                const previouslyAssignedIds = new Set(existingAssignments.map(a => a.sensorId));
                const newSensorIds = (parsedSelectedSensors as { id: string }[])
                    .map(s => s.id)
                    .filter(sid => !previouslyAssignedIds.has(sid));

                // Remove all existing assignments, then recreate
                await prisma.sensorTemplateAssignment.deleteMany({
                    where: { templateId: id }
                });

                if (parsedSelectedSensors.length > 0) {
                    await prisma.sensorTemplateAssignment.createMany({
                        data: parsedSelectedSensors.map((sensor: { id: string }) => ({
                            templateId: id,
                            sensorId: sensor.id,
                            assignedBy: user?.id
                        }))
                    });

                    // Apply template config only to NEWLY assigned sensors
                    if (newSensorIds.length > 0) {
                        const templateConfig = (config as Record<string, unknown>) || {};
                        for (const sensorId of newSensorIds) {
                            // Verify sensor belongs to current account before updating
                            const sensor = await prisma.sensor.findFirst({
                                where: { id: sensorId, accountId },
                                select: { config: true, configVersion: true }
                            });
                            if (!sensor) continue;
                            const merged = {
                                ...(typeof sensor.config === 'object' && sensor.config !== null ? (sensor.config as Record<string, unknown>) : {}),
                                ...templateConfig
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
