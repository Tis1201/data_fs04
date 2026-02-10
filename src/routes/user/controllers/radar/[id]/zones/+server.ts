import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

// Type definitions
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
    active?: boolean;
}

interface RadarConfig {
    trackingArea?: unknown;
    zones?: Zone[];
    dwellBuckets?: unknown[];
    alertSettings?: unknown;
}

const updateZonesSchema = z.array(z.object({
    id: z.string(),
    name: z.string(),
    active: z.boolean()
}));

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
 * PATCH: Update zone active status (partial update - only name and active)
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
        const parsed = updateZonesSchema.safeParse(body);
        
        if (!parsed.success) {
            return json({ error: 'Invalid zones data', details: parsed.error.flatten() }, { status: 400 });
        }

        // Update config - only update name and active status for existing zones
        const config = (sensor.config as unknown as RadarConfig) || {};
        const existingZones = config.zones || [];
        
        // Update existing zones with new name/active status
        const updatedZones = existingZones.map(zone => {
            const update = parsed.data.find(u => u.id === zone.id);
            if (update) {
                return {
                    ...zone,
                    name: update.name,
                    active: update.active
                };
            }
            return zone;
        });
        
        config.zones = updatedZones;

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
        logger.error('Error updating zones:', err);
        throw error(500, 'Failed to update zones');
    }
};
