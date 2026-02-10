import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

// Type definitions
interface AlertSettings {
    sensorOffline?: { enabled: boolean; threshold: string; unit: string };
    noData?: { enabled: boolean; threshold: string; unit: string };
    dwellTime?: { enabled: boolean; zoneId: string; threshold: string };
    email?: { enabled: boolean; address: string };
    webhook?: { enabled: boolean; url: string };
}

interface RadarConfig {
    trackingArea?: unknown;
    zones?: unknown[];
    dwellBuckets?: unknown[];
    alertSettings?: AlertSettings;
}

const updateAlertSettingsSchema = z.object({
    sensorOffline: z.object({
        enabled: z.boolean(),
        threshold: z.string(),
        unit: z.string()
    }).optional(),
    noData: z.object({
        enabled: z.boolean(),
        threshold: z.string(),
        unit: z.string()
    }).optional(),
    dwellTime: z.object({
        enabled: z.boolean(),
        zoneId: z.string(),
        threshold: z.string()
    }).optional(),
    email: z.object({
        enabled: z.boolean(),
        address: z.string()
    }).optional(),
    webhook: z.object({
        enabled: z.boolean(),
        url: z.string()
    }).optional()
});

/**
 * Helper to get sensor from controller ID (uses raw prisma)
 */
async function getSensorFromControllerId(controllerId: string) {
    const controller = await prisma.controller.findUnique({
        where: { id: controllerId },
        include: { sensors: true }
    });
    if (!controller) return { error: 'Controller not found', sensor: null };
    const sensor = controller.sensors[0];
    if (!sensor) return { error: 'Sensor not found for this controller', sensor: null };
    return { error: null, sensor };
}

/**
 * Helper to check account access (uses raw prisma)
 */
async function checkAccountAccess(controllerId: string, accountId: string) {
    const controller = await prisma.controller.findFirst({
        where: {
            id: controllerId,
            accountId: accountId
        }
    });
    if (!controller) {
        throw error(403, 'Access denied');
    }
    return controller;
}

export const PUT: RequestHandler = async ({ request, params, locals, cookies }) => {
    const { id: controllerId } = params;
    
    // Get current account ID
    const currentAccountId = cookies.get('current_account_id') || 
        (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
    
    if (!currentAccountId) {
        throw error(403, 'User account not found');
    }

    try {
        // Check access
        await checkAccountAccess(controllerId, currentAccountId as string);
        
        // Get sensor
        const { error: sensorError, sensor } = await getSensorFromControllerId(controllerId);
        if (sensorError || !sensor) {
            throw error(404, sensorError || 'Sensor not found');
        }

        // Parse and validate body
        const body = await request.json();
        const parsed = updateAlertSettingsSchema.safeParse(body);
        
        if (!parsed.success) {
            return json({ error: 'Invalid alert settings', details: parsed.error.flatten() }, { status: 400 });
        }

        // Update config
        const config = (sensor.config as unknown as RadarConfig) || {};
        config.alertSettings = { ...config.alertSettings, ...parsed.data };

        await prisma.sensor.update({
            where: { id: sensor.id },
            data: { 
                config: config as object, 
                updatedAt: new Date() 
            }
        });

        return json({ success: true });
    } catch (err: unknown) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }
        logger.error('Error updating alert settings:', err);
        throw error(500, 'Failed to update alert settings');
    }
};
