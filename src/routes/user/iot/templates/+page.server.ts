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

/**
 * Template row shape for list (name, type, assigned count, updated, isDefault).
 */
export interface TemplateRow {
    id: string;
    name: string;
    type: 'Alert' | 'Configuration';
    assignedSensors: number;
    lastUpdatedOn: string;
    isDefault: boolean;
    description?: string;
    config?: {
        trackingArea?: { xMin: string; xMax: string; yMin: string; yMax: string };
        zones?: { id: string; name: string; active: boolean }[];
        deviceSettings?: {
            deviceMode: string;
            timezone: string;
            pathTracking: boolean;
            dwellThreshold: number;
        };
    };
    assignedSensorsList?: { id: string; name: string; mac?: string }[];
}

// Helper to map database type to display type
function mapTemplateType(type: SensorTemplateType): 'Alert' | 'Configuration' {
    return type === SensorTemplateType.ALERT ? 'Alert' : 'Configuration';
}

// Helper to map display type to database type
function parseTemplateType(type: string): SensorTemplateType {
    return type.toLowerCase() === 'alert' ? SensorTemplateType.ALERT : SensorTemplateType.CONFIGURATION;
}

// Helper to get current account ID from cookies or locals
function getCurrentAccountId(cookies: { get: (name: string) => string | undefined }, locals: App.Locals): string | undefined {
    return cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
}

export const load = restrict(
    async ({ url, depends, locals, cookies }: AuthenticatedLoadEvent) => {
        depends('app:userTemplates');

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const perPage = Math.min(100, Math.max(10, parseInt(url.searchParams.get('per_page') || '10', 10)));
        const search = (url.searchParams.get('search') || '').trim();
        const sortField = url.searchParams.get('sort') || 'updatedAt';
        const sortOrder = (url.searchParams.get('order') || 'desc') as 'asc' | 'desc';

        // Get current account ID from cookie or locals
        const accountId = getCurrentAccountId(cookies, locals);

        if (!accountId) {
            return {
                templates: [],
                meta: {
                    pagination: { page: 1, per_page: perPage, total_records: 0, total_pages: 1 },
                    sort: { field: sortField, order: sortOrder },
                    filters: { search }
                }
            };
        }

        // Build where clause
        const where: {
            accountId: string;
            OR?: Array<{ name?: { contains: string; mode: 'insensitive' }; description?: { contains: string; mode: 'insensitive' } }>;
        } = {
            accountId
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Map sort field to database column
        const dbSortField = sortField === 'lastUpdatedOn' ? 'updatedAt' : sortField;
        const validSortFields = ['name', 'type', 'updatedAt', 'createdAt', 'isDefault'];
        const orderByField = validSortFields.includes(dbSortField) ? dbSortField : 'updatedAt';

        // Count total records
        const totalRecords = await prisma.sensorTemplate.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));

        // Fetch templates with assignments
        const dbTemplates = await prisma.sensorTemplate.findMany({
            where,
            orderBy: { [orderByField]: sortOrder },
            skip: (page - 1) * perPage,
            take: perPage,
            include: {
                sensorAssignments: {
                    include: {
                        sensor: {
                            select: { id: true, name: true, serialNumber: true }
                        }
                    }
                }
            }
        });

        // Map to TemplateRow
        const templates: TemplateRow[] = dbTemplates.map(t => ({
            id: t.id,
            name: t.name,
            type: mapTemplateType(t.type as SensorTemplateType),
            assignedSensors: t.sensorAssignments.length,
            lastUpdatedOn: t.updatedAt.toISOString(),
            isDefault: t.isDefault,
            description: t.description ?? undefined,
            config: t.config as TemplateRow['config'] ?? undefined,
            assignedSensorsList: t.sensorAssignments.map((a: { sensor: { id: string; name: string | null; serialNumber: string | null } }) => ({
                id: a.sensor.id,
                name: a.sensor.name || 'Unnamed Sensor',
                mac: a.sensor.serialNumber || ''
            }))
        }));

        // Load available sensors for edit modal
        const sensors = await prisma.sensor.findMany({
            where: { accountId },
            select: { id: true, name: true, serialNumber: true }
        });
        const availableSensors = sensors.map(s => ({
            id: s.id,
            name: s.name || 'Unnamed Sensor',
            mac: s.serialNumber || ''
        }));

        return {
            templates,
            availableSensors,
            meta: {
                pagination: { page, per_page: perPage, total_records: totalRecords, total_pages: totalPages },
                sort: { field: sortField, order: sortOrder },
                filters: { search }
            }
        };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

export const actions: Actions = {
    create: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const name = form.get('name') as string | null;
            const description = form.get('description') as string | null;
            const type = form.get('type') as string | null;
            const trackingArea = form.get('trackingArea') as string | null;
            const zones = form.get('zones') as string | null;
            const deviceSettings = form.get('deviceSettings') as string | null;
            const alertSettingsRaw = form.get('alertSettings') as string | null;
            const selectedSensors = form.get('selectedSensors') as string | null;

            if (!name?.trim()) return { success: false, error: 'Template name is required' };
            if (name.length > 50) return { success: false, error: 'Template name must be 50 characters or less' };
            if (!type) return { success: false, error: 'Template type is required' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            const user = locals.user;

            // Check for duplicate template name within the account
            const existingTemplate = await prisma.sensorTemplate.findFirst({
                where: {
                    accountId,
                    name: { equals: name.trim(), mode: 'insensitive' }
                },
                select: { id: true }
            });
            if (existingTemplate) {
                return { success: false, error: 'Template name already exists' };
            }

            // Parse JSON fields
            const parsedTrackingArea = trackingArea ? JSON.parse(trackingArea) : null;
            const parsedZones = zones ? JSON.parse(zones) : [];
            const parsedDeviceSettings = deviceSettings ? JSON.parse(deviceSettings) : null;
            const parsedAlertSettings =
                alertSettingsRaw && typeof alertSettingsRaw === 'string' && alertSettingsRaw.trim().startsWith('{')
                    ? JSON.parse(alertSettingsRaw)
                    : undefined;
            const parsedSelectedSensors = selectedSensors ? JSON.parse(selectedSensors) : [];

            // Build config object (include alertSettings for Alert templates)
            const config: Record<string, unknown> = {
                trackingArea: parsedTrackingArea,
                zones: parsedZones,
                deviceSettings: parsedDeviceSettings
            };
            if (parsedAlertSettings != null) {
                config.alertSettings = parsedAlertSettings;
            }

            try {
                // Verify all selected sensors belong to current account
                if (parsedSelectedSensors.length > 0) {
                    const sensorIds = parsedSelectedSensors.map((s: { id: string }) => s.id);
                    const validSensors = await prisma.sensor.findMany({
                        where: { id: { in: sensorIds }, accountId },
                        select: { id: true }
                    });
                    const validSensorIds = new Set(validSensors.map(s => s.id));
                    const invalidSensors = sensorIds.filter((id: string) => !validSensorIds.has(id));
                    if (invalidSensors.length > 0) {
                        return { success: false, error: 'Some selected sensors do not belong to your account' };
                    }
                }

                // Create template in database
                const template = await prisma.sensorTemplate.create({
                    data: {
                        name: name.trim(),
                        description: description?.trim() || null,
                        type: parseTemplateType(type),
                        config: config as Prisma.InputJsonValue,
                        accountId,
                        createdBy: user?.id
                    }
                });

                // Create sensor assignments if any sensors were selected
                if (parsedSelectedSensors.length > 0) {
                    await prisma.sensorTemplateAssignment.createMany({
                        data: parsedSelectedSensors.map((sensor: { id: string }) => ({
                            templateId: template.id,
                            sensorId: sensor.id,
                            assignedBy: user?.id
                        }))
                    });
                }

                return { success: true, templateId: template.id };
            } catch (err) {
                console.error('Failed to create template:', err);
                return { success: false, error: 'Failed to create template' };
            }
        },
        [SystemRole.USER]
    ),
    update: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            const name = form.get('name') as string | null;
            const description = form.get('description') as string | null;
            const trackingArea = form.get('trackingArea') as string | null;
            const zones = form.get('zones') as string | null;
            const deviceSettings = form.get('deviceSettings') as string | null;
            const alertSettings = form.get('alertSettings') as string | null;
            const selectedSensors = form.get('selectedSensors') as string | null;

            if (!id) return { success: false, error: 'Missing template id' };
            if (!name?.trim()) return { success: false, error: 'Template name is required' };
            if (name.length > 50) return { success: false, error: 'Template name must be 50 characters or less' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            try {
                // Verify template belongs to user's account
                const template = await prisma.sensorTemplate.findFirst({
                    where: { id, accountId }
                });

                if (!template) {
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

                // Parse JSON fields
                const parsedTrackingArea = trackingArea ? JSON.parse(trackingArea) : null;
                const parsedZones = zones ? JSON.parse(zones) : [];
                const parsedDeviceSettings = deviceSettings ? JSON.parse(deviceSettings) : null;
                const parsedAlertSettings = alertSettings ? JSON.parse(alertSettings) : null;
                const parsedSelectedSensors = selectedSensors ? JSON.parse(selectedSensors) : [];

                // Build config object, preserving existing config structure
                const existingConfig = (template.config as Record<string, unknown>) || {};
                const config: Record<string, unknown> = {
                    ...existingConfig,
                    trackingArea: parsedTrackingArea,
                    zones: parsedZones,
                    deviceSettings: parsedDeviceSettings
                };
                if (parsedAlertSettings != null) {
                    config.alertSettings = parsedAlertSettings;
                }

                // Verify all selected sensors belong to current account
                if (parsedSelectedSensors.length > 0) {
                    const sensorIds = parsedSelectedSensors.map((s: { id: string }) => s.id);
                    const validSensors = await prisma.sensor.findMany({
                        where: { id: { in: sensorIds }, accountId },
                        select: { id: true }
                    });
                    const validSensorIds = new Set(validSensors.map(s => s.id));
                    const invalidSensors = sensorIds.filter((sid: string) => !validSensorIds.has(sid));
                    if (invalidSensors.length > 0) {
                        return { success: false, error: 'Some selected sensors do not belong to your account' };
                    }
                }

                // Update template (include accountId for defense-in-depth)
                await prisma.sensorTemplate.update({
                    where: { id, accountId },
                    data: {
                        name: name.trim(),
                        description: description?.trim() || null,
                        config: config as Prisma.InputJsonValue
                    }
                });

                // Update sensor assignments
                // First, delete existing assignments
                await prisma.sensorTemplateAssignment.deleteMany({
                    where: { templateId: id }
                });

                // Then create new assignments
                if (parsedSelectedSensors.length > 0) {
                    await prisma.sensorTemplateAssignment.createMany({
                        data: parsedSelectedSensors.map((sensor: { id: string }) => ({
                            templateId: id,
                            sensorId: sensor.id
                        }))
                    });
                }

                return { success: true };
            } catch (err) {
                console.error('Failed to update template:', err);
                return { success: false, error: 'Failed to update template' };
            }
        },
        [SystemRole.USER]
    ),
    delete: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            if (!id) return { success: false, error: 'Missing template id' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            try {
                // Verify template belongs to user's account
                const template = await prisma.sensorTemplate.findFirst({
                    where: { id, accountId }
                });

                if (!template) {
                    return { success: false, error: 'Template not found' };
                }

                // Delete template (cascade will delete assignments)
                await prisma.sensorTemplate.delete({
                    where: { id }
                });

                return { success: true };
            } catch (err) {
                console.error('Failed to delete template:', err);
                return { success: false, error: 'Failed to delete template' };
            }
        },
        [SystemRole.USER]
    ),
    duplicate: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            if (!id) return { success: false, error: 'Missing template id' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            const user = locals.user;

            try {
                // Find original template
                const original = await prisma.sensorTemplate.findFirst({
                    where: { id, accountId }
                });

                if (!original) {
                    return { success: false, error: 'Template not found' };
                }

                // Create duplicate with "(Copy)" suffix
                const duplicate = await prisma.sensorTemplate.create({
                    data: {
                        name: `${original.name} (Copy)`,
                        description: original.description,
                        type: original.type,
                        config: original.config ?? undefined,
                        isDefault: false, // Duplicate should not be default
                        accountId,
                        createdBy: user?.id
                    }
                });

                return { success: true, templateId: duplicate.id };
            } catch (err) {
                console.error('Failed to duplicate template:', err);
                return { success: false, error: 'Failed to duplicate template' };
            }
        },
        [SystemRole.USER]
    ),
    setDefault: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;
            if (!id) return { success: false, error: 'Missing template id' };

            const accountId = getCurrentAccountId(cookies, locals);
            if (!accountId) return { success: false, error: 'No account found' };

            try {
                // Verify template belongs to user's account
                const template = await prisma.sensorTemplate.findFirst({
                    where: { id, accountId }
                });

                if (!template) {
                    return { success: false, error: 'Template not found' };
                }

                // Use transaction to ensure only one default per type
                await prisma.$transaction([
                    // Remove default from other templates of same type in this account
                    prisma.sensorTemplate.updateMany({
                        where: {
                            accountId,
                            type: template.type,
                            isDefault: true,
                            id: { not: id }
                        },
                        data: { isDefault: false }
                    }),
                    // Set this template as default
                    prisma.sensorTemplate.update({
                        where: { id },
                        data: { isDefault: true }
                    })
                ]);

                return { success: true };
            } catch (err) {
                console.error('Failed to set default template:', err);
                return { success: false, error: 'Failed to set default template' };
            }
        },
        [SystemRole.USER]
    )
};
