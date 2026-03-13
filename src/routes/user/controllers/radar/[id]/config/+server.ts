import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

// Type definitions
interface RadarConfig {
    trackingArea?: {
        id?: string;
        name?: string;
        startX: number;
        startY: number;
        endX: number;
        endY: number;
        description?: string;
    };
    zones?: unknown[];
    dwellBuckets?: unknown[];
    alertSettings?: unknown;
    deviceMode?: string;
    timezone?: string;
    pathTracking?: boolean;
    dwellThreshold?: number;
}

// Tracking area constraints: X [-4, 4], Y [0, 7]
const TRACKING_AREA_CONSTRAINTS = {
    X_MIN: -4,
    X_MAX: 4,
    Y_MIN: 0,
    Y_MAX: 7
};

const updateConfigSchema = z.object({
    trackingArea: z.object({
        startX: z.number().min(TRACKING_AREA_CONSTRAINTS.X_MIN).max(TRACKING_AREA_CONSTRAINTS.X_MAX),
        startY: z.number().min(TRACKING_AREA_CONSTRAINTS.Y_MIN).max(TRACKING_AREA_CONSTRAINTS.Y_MAX),
        endX: z.number().min(TRACKING_AREA_CONSTRAINTS.X_MIN).max(TRACKING_AREA_CONSTRAINTS.X_MAX),
        endY: z.number().min(TRACKING_AREA_CONSTRAINTS.Y_MIN).max(TRACKING_AREA_CONSTRAINTS.Y_MAX)
    }).optional(),
    deviceSettings: z.object({
        deviceMode: z.string(),
        timezone: z.string(),
        pathTracking: z.boolean(),
        dwellThreshold: z.number()
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

/**
 * PATCH: Update sensor configuration (tracking area, device settings)
 */
export const PATCH: RequestHandler = async ({ request, params, locals, cookies }) => {
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
        const parsed = updateConfigSchema.safeParse(body);
        
        if (!parsed.success) {
            // Check if it's a tracking area range error
            const flatErrors = parsed.error.flatten();
            const hasRangeError = flatErrors.fieldErrors.trackingArea?.some(e => 
                e.includes('too_small') || e.includes('too_big') || e.includes('Number must be')
            );
            if (hasRangeError) {
                return json({ 
                    error: `Tracking area out of range. X must be between ${TRACKING_AREA_CONSTRAINTS.X_MIN} and ${TRACKING_AREA_CONSTRAINTS.X_MAX}, Y must be between ${TRACKING_AREA_CONSTRAINTS.Y_MIN} and ${TRACKING_AREA_CONSTRAINTS.Y_MAX}.`,
                    details: flatErrors 
                }, { status: 400 });
            }
            return json({ error: 'Invalid configuration data', details: flatErrors }, { status: 400 });
        }

        // Update config
        const config = (sensor.config as unknown as RadarConfig) || {};
        
        // Update tracking area if provided
        if (parsed.data.trackingArea) {
            const existingTA = config.trackingArea || {};
            config.trackingArea = {
                ...existingTA,
                id: existingTA.id || 'tracking-area-1',
                name: existingTA.name || 'Main Tracking Area',
                startX: parsed.data.trackingArea.startX,
                startY: parsed.data.trackingArea.startY,
                endX: parsed.data.trackingArea.endX,
                endY: parsed.data.trackingArea.endY
            };
        }
        
        // Update device settings at top-level (consistent with initial config structure)
        if (parsed.data.deviceSettings) {
            if (parsed.data.deviceSettings.deviceMode !== undefined) config.deviceMode = parsed.data.deviceSettings.deviceMode;
            if (parsed.data.deviceSettings.timezone !== undefined) config.timezone = parsed.data.deviceSettings.timezone;
            if (parsed.data.deviceSettings.pathTracking !== undefined) config.pathTracking = parsed.data.deviceSettings.pathTracking;
            if (parsed.data.deviceSettings.dwellThreshold !== undefined) config.dwellThreshold = parsed.data.deviceSettings.dwellThreshold;
        }

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
        logger.error('Error updating configuration:', err);
        throw error(500, 'Failed to update configuration');
    }
};
