import { randomBytes } from 'node:crypto';
import { ProfileConfigBuilder } from '$lib/server/device/profile/ProfileConfigBuilder';
import { ADD_DEVICE_TRACKING_DEFAULTS } from '$lib/components/ui_components_sveltekit/radar/constraints';
import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { logger } from '$lib/server/logger';

/** Random id for trackingArea/zones — same style as client `buildInitConfigFromStep2` (alphanumeric). */
function genInitConfigId(): string {
    const part = () =>
        randomBytes(12)
            .toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 13);
    const a = part();
    const b = part();
    const combined = `${a}${b}`;
    if (combined.length >= 8) return combined;
    return `r${randomBytes(16).toString('hex')}`;
}

/** Step 2 state shape for Add Device (radar) — matches +page.svelte `addDeviceStep2`. */
export type RadarAddDeviceStep2State = {
    configTemplate: string;
    trackingXMin: string;
    trackingXMax: string;
    trackingYMin: string;
    trackingYMax: string;
    deviceMode: string;
    timezone: string;
    pathTracking: boolean;
    dwellThreshold: string;
    zones: { id: string; name: string; active: boolean }[];
};

function defaultStep2(): RadarAddDeviceStep2State {
    return {
        configTemplate: 'CUSTOM',
        trackingXMin: String(ADD_DEVICE_TRACKING_DEFAULTS.X_MIN),
        trackingXMax: String(ADD_DEVICE_TRACKING_DEFAULTS.X_MAX),
        trackingYMin: String(ADD_DEVICE_TRACKING_DEFAULTS.Y_MIN),
        trackingYMax: String(ADD_DEVICE_TRACKING_DEFAULTS.Y_MAX),
        deviceMode: 'LIVE_PREVIEW',
        timezone: 'UTC',
        pathTracking: true,
        dwellThreshold: '0',
        zones: [{ id: 'zone-1', name: 'Zone 1', active: false }]
    };
}

/**
 * After MQTT claim, load effective profile for the device and build Step 2 defaults.
 * When an active assignment exists and the merged profile has effective settings, fields are read-only in the UI.
 */
export async function buildRadarAddDeviceStep2FromClaimedDevice(
    prisma: PrismaClient,
    deviceId: string,
    accountId: string
): Promise<{
    locked: boolean;
    profileName: string | null;
    deviceName: string;
    step2: RadarAddDeviceStep2State;
} | null> {
    const device = await prisma.device.findFirst({
        where: { id: deviceId, accountId },
        select: { id: true, name: true }
    });
    if (!device) return null;

    const assignment = await prisma.deviceProfileAssignment.findUnique({
        where: { deviceId },
        include: { profile: { select: { id: true, name: true, isActive: true } } }
    });

    const builder = new ProfileConfigBuilder(prisma);
    const { config, metadata } = await builder.buildEffectiveConfig(deviceId);

    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
        const val = (v as { value?: unknown }).value;
        flat[k] = val != null ? String(val) : '';
    }

    const hasEffectiveSettings = Object.keys(config).length > 0;
    const locked =
        !!assignment?.profile?.isActive &&
        assignment.status === 'ACTIVE' &&
        hasEffectiveSettings &&
        !!metadata.profileId;

    const step2 = defaultStep2();
    const tz = flat.timezone?.trim();
    if (tz) step2.timezone = tz;

    const radarRaw =
        flat.radar_init_config?.trim() ||
        flat.radar_sensor_init_config?.trim() ||
        flat.radar_wizard_defaults?.trim();
    if (radarRaw) {
        try {
            const j = JSON.parse(radarRaw) as Record<string, unknown>;
            const ta = (j.trackingArea ?? j.tracking_area) as Record<string, unknown> | undefined;
            if (ta) {
                const sx = Number(ta.startX);
                const sy = Number(ta.startY);
                const ex = Number(ta.endX);
                const ey = Number(ta.endY);
                if (Number.isFinite(sx)) step2.trackingXMin = String(sx);
                if (Number.isFinite(sy)) step2.trackingYMin = String(sy);
                if (Number.isFinite(ex)) step2.trackingXMax = String(ex);
                if (Number.isFinite(ey)) step2.trackingYMax = String(ey);
            }
            const zones = j.zones;
            if (Array.isArray(zones) && zones.length > 0) {
                step2.zones = zones.map((z: Record<string, unknown>, i: number) => ({
                    id: typeof z.id === 'string' && z.id ? z.id : `zone-${i + 1}`,
                    name: typeof z.name === 'string' && z.name.trim() ? z.name : `Zone ${i + 1}`,
                    active: z.active === true
                }));
            }
            const dm = j.deviceMode ?? j.device_mode;
            if (typeof dm === 'string' && dm) step2.deviceMode = dm;
            if (typeof j.pathTracking === 'boolean') step2.pathTracking = j.pathTracking;
            const dwell = j.dwellThreshold ?? j.dwell_threshold;
            if (dwell !== undefined && dwell !== null) step2.dwellThreshold = String(dwell);
        } catch {
            /* ignore invalid JSON */
        }
    }

    return {
        locked,
        profileName: assignment?.profile?.name ?? metadata.profileName ?? null,
        deviceName: device.name,
        step2
    };
}

/**
 * Build sensor `config` JSON from Step 2 state (matches client `buildInitConfigFromStep2` in radar +page.svelte).
 */
export function buildRadarInitConfigJsonFromStep2(
    step2: RadarAddDeviceStep2State,
    sensorDisplayName: string
): Record<string, unknown> {
    const xMin = parseFloat(step2.trackingXMin);
    const xMax = parseFloat(step2.trackingXMax);
    const yMin = parseFloat(step2.trackingYMin);
    const yMax = parseFloat(step2.trackingYMax);
    const d = ADD_DEVICE_TRACKING_DEFAULTS;
    const startX = Number.isFinite(xMin) ? xMin : d.X_MIN;
    const endX = Number.isFinite(xMax) ? xMax : d.X_MAX;
    const startY = Number.isFinite(yMin) ? yMin : d.Y_MIN;
    const endY = Number.isFinite(yMax) ? yMax : d.Y_MAX;
    const baseName = sensorDisplayName?.trim() || 'Sensor';
    const trackingArea = {
        id: genInitConfigId(),
        name: `${baseName} Tracking Area`,
        startX,
        startY,
        endX: Math.max(startX, endX),
        endY: Math.max(startY, endY)
    };
    const zones = (step2.zones || []).map((z, i) => ({
        id: genInitConfigId(),
        name: z.name?.trim() || `Zone ${i + 1}`,
        zoneNumber: i + 1,
        active: z.active,
        startX: trackingArea.startX,
        startY: trackingArea.startY,
        endX: trackingArea.endX,
        endY: trackingArea.endY
    }));
    return {
        trackingArea,
        zones,
        deviceMode: step2.deviceMode || 'LIVE_PREVIEW',
        timezone: step2.timezone || 'UTC',
        pathTracking: step2.pathTracking ?? true,
        dwellThreshold: parseFloat(step2.dwellThreshold) || 0
    };
}

/**
 * Effective device profile → init `config` for a new radar sensor (timezone, tracking, zones from profile).
 * On failure (DB/profile errors), returns `{}` so sensor creation can still succeed without profile defaults.
 */
export async function buildRadarInitConfigFromDeviceProfile(
    prisma: PrismaClient,
    deviceId: string,
    accountId: string,
    sensorDisplayName: string
): Promise<Prisma.InputJsonValue> {
    try {
        const payload = await buildRadarAddDeviceStep2FromClaimedDevice(prisma, deviceId, accountId);
        if (!payload) return {};
        const name = (sensorDisplayName || payload.deviceName || '').trim() || 'Sensor';
        return buildRadarInitConfigJsonFromStep2(payload.step2, name) as Prisma.InputJsonValue;
    } catch (e) {
        logger.warn(
            `[buildRadarInitConfigFromDeviceProfile] Falling back to empty config for deviceId=${deviceId}: ${
                e instanceof Error ? e.message : String(e)
            }`
        );
        return {};
    }
}
