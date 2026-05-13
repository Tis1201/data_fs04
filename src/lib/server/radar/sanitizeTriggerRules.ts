import type { RadarTriggerRule } from '$lib/types/radarTriggerRule';

const MAX_RULES = 20;

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseUrl(url: string): boolean {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
        return false;
    }
}

/**
 * Validates and normalizes trigger rules from client JSON.
 * `allowedTrackingKeys` must include `"entire"` plus every acceptable zone reference.
 */
export function sanitizeTriggerRulesFromPayload(
    raw: unknown,
    allowedTrackingKeys: Set<string>
): { ok: true; rules: RadarTriggerRule[] } | { ok: false; error: string } {
    if (raw === undefined || raw === null) {
        return { ok: true, rules: [] };
    }
    if (!Array.isArray(raw)) {
        return { ok: false, error: 'triggerRules must be an array' };
    }
    if (raw.length > MAX_RULES) {
        return { ok: false, error: `At most ${MAX_RULES} trigger rules allowed` };
    }

    const rules: RadarTriggerRule[] = [];

    for (let i = 0; i < raw.length; i++) {
        const item = raw[i];
        if (!isRecord(item)) {
            return { ok: false, error: `Rule ${i + 1}: invalid object` };
        }
        const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : '';
        if (!id) {
            return { ok: false, error: `Rule ${i + 1}: id is required` };
        }
        const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : '';
        if (!name) {
            return { ok: false, error: `Rule ${i + 1}: name is required` };
        }
        const enabled = typeof item.enabled === 'boolean' ? item.enabled : true;

        const condRaw = item.conditions;
        if (!isRecord(condRaw)) {
            return { ok: false, error: `Rule ${i + 1}: conditions must be an object` };
        }
        const dwellRaw = condRaw.dwell_time_sec;
        const dwell =
            dwellRaw === undefined || dwellRaw === null
                ? 0
                : Number(dwellRaw);
        if (!Number.isFinite(dwell) || dwell < 0) {
            return { ok: false, error: `Rule ${i + 1}: dwell_time_sec must be a non-negative number` };
        }
        const dwellInt = Math.floor(dwell);

        let proximity: { min?: number; max?: number } | undefined;
        const proxRaw = condRaw.proximity;
        if (proxRaw !== undefined && proxRaw !== null) {
            if (!isRecord(proxRaw)) {
                return { ok: false, error: `Rule ${i + 1}: proximity must be an object` };
            }
            const min = proxRaw.min !== undefined ? Number(proxRaw.min) : undefined;
            const max = proxRaw.max !== undefined ? Number(proxRaw.max) : undefined;
            if (min !== undefined && !Number.isFinite(min)) {
                return { ok: false, error: `Rule ${i + 1}: proximity.min invalid` };
            }
            if (max !== undefined && !Number.isFinite(max)) {
                return { ok: false, error: `Rule ${i + 1}: proximity.max invalid` };
            }
            if (min !== undefined && max !== undefined && min > max) {
                return { ok: false, error: `Rule ${i + 1}: proximity min must be ≤ max` };
            }
            proximity = {};
            if (min !== undefined) proximity.min = min;
            if (max !== undefined) proximity.max = max;
        }

        const taRaw = condRaw.tracking_area;
        let tracking_area = typeof taRaw === 'string' && taRaw.trim() ? taRaw.trim() : 'entire';
        if (!allowedTrackingKeys.has(tracking_area)) {
            tracking_area = 'entire';
        }

        const trigRaw = item.trigger;
        const once =
            isRecord(trigRaw) && typeof trigRaw.once_per_target === 'boolean'
                ? trigRaw.once_per_target
                : true;
        const cooldownRaw = isRecord(trigRaw) ? trigRaw.cooldown_sec : undefined;
        const cooldown = cooldownRaw !== undefined && cooldownRaw !== null
            ? Math.max(0, Math.floor(Number(cooldownRaw) || 0))
            : 0;

        const actRaw = item.action;
        if (!isRecord(actRaw)) {
            return { ok: false, error: `Rule ${i + 1}: action must be an object` };
        }
        if (actRaw.type !== 'webhook') {
            return { ok: false, error: `Rule ${i + 1}: action.type must be "webhook"` };
        }
        const url = typeof actRaw.url === 'string' ? actRaw.url.trim() : '';
        if (!url || !parseUrl(url)) {
            return { ok: false, error: `Rule ${i + 1}: action.url must be a valid http(s) URL` };
        }

        let auth: RadarTriggerRule['action']['auth'] = { type: 'none' };
        const authRaw = actRaw.auth;
        if (authRaw !== undefined && authRaw !== null) {
            if (!isRecord(authRaw)) {
                return { ok: false, error: `Rule ${i + 1}: action.auth must be an object` };
            }
            const t = authRaw.type === 'header' ? 'header' : 'none';
            if (t === 'header') {
                const key = typeof authRaw.key === 'string' ? authRaw.key.trim() : '';
                const value = typeof authRaw.value === 'string' ? authRaw.value : '';
                auth = { type: 'header', key: key || 'Authorization', value };
            } else {
                auth = { type: 'none' };
            }
        }

        rules.push({
            id,
            name,
            enabled,
            conditions: {
                dwell_time_sec: dwellInt,
                ...(proximity && Object.keys(proximity).length ? { proximity } : {}),
                tracking_area,
            },
            trigger: { once_per_target: once, cooldown_sec: cooldown },
            action: { type: 'webhook', url, auth },
        });
    }

    return { ok: true, rules };
}
