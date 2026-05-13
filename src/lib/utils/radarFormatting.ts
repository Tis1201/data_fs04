/**
 * Shared formatting utilities for radar/sensor analytics.
 * Used by analytics radar page, radar controller, and CSV exports.
 */

/** Format duration in seconds to a human-readable string (e.g. "4s", "2m 15s"). Rounds to nearest second. Shows "<1s" when rounded to 0 instead of "0s". */
export function formatDuration(sec: number): string {
    const rounded = Math.round(sec);
    if (rounded === 0) return '<1s';
    if (rounded < 60) return `${rounded}s`;
    const m = Math.floor(rounded / 60);
    const s = rounded % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
}

/** Round dwell seconds to nearest integer. Use for display or export to avoid floats like 3.719999999. */
export function roundDwellSec(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Format proximity in meters to 1 decimal place. Returns — for null/undefined/NaN. */
export function formatProximityM(value: unknown): string {
    if (value == null) return '—';
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n.toFixed(1) : '—';
}

/** Format zone_dwell_times_json for display: round all numeric values to avoid floats. Returns '—' for empty/null. */
export function formatZoneDwellJson(zoneJson: unknown, maxLength = 80): string {
    if (zoneJson == null || zoneJson === '' || String(zoneJson).trim() === '{}') {
        return '—';
    }
    try {
        const parsed = typeof zoneJson === 'string' ? JSON.parse(zoneJson) : zoneJson;
        const rounded: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
            const n = typeof v === 'number' ? v : Number(v);
            rounded[k] = Number.isFinite(n) ? Math.round(n) : 0;
        }
        const raw = JSON.stringify(rounded);
        return raw.length > maxLength ? raw.slice(0, maxLength - 1) + '…' : raw;
    } catch {
        const s = String(zoneJson);
        return s.length > maxLength ? s.slice(0, maxLength - 1) + '…' : s;
    }
}
