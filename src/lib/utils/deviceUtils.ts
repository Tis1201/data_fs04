/**
 * Shared device helpers for UI (status, type, dates, connection) and for MAC/EUI-48 handling.
 *
 * MAC functions are used from both client and server (registration, claim, Prisma queries).
 * Prefer {@link macQueryVariants} when matching DB fields that may store colon or compact hex.
 */

/** Maps device status enum values to short labels for tables and badges. */
export const DEVICE_STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    PENDING: 'Pending',
    OFFLINE: 'Offline',
    ONLINE: 'Online'
};

/** Resolved label for a status string, or `"Unknown"` / the raw string if unmapped. */
export function getDeviceStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return DEVICE_STATUS_LABELS[status] || String(status);
}

/** Badge variant for design-system status chips. */
export function getDeviceStatusVariant(
    status: string | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (!status) return 'outline';

    const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
        ACTIVE: 'success',
        INACTIVE: 'secondary',
        PENDING: 'default',
        OFFLINE: 'destructive',
        ONLINE: 'success'
    };

    return variantMap[status] || 'outline';
}

/** Tailwind utility classes for colored status text in list rows. */
export function getDeviceStatusTextClass(status: string | null | undefined): string {
    if (!status) return 'text-muted-foreground';

    const classMap: Record<string, string> = {
        ACTIVE: 'text-green-600',
        INACTIVE: 'text-muted-foreground',
        PENDING: 'text-blue-600',
        OFFLINE: 'text-red-600',
        ONLINE: 'text-green-600'
    };

    return classMap[status] || 'text-muted-foreground';
}

/** Maps device type enum values to display names. */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
    PHONE: 'Phone',
    TABLET: 'Tablet',
    DESKTOP: 'Desktop',
    SERVER: 'Server',
    EMBEDDED: 'Embedded',
    IOT: 'IoT Device',
    OTHER: 'Other'
};

/** Display name for a device type, or `"Unknown"` / raw value if unmapped. */
export function getDeviceTypeDisplay(deviceType: string | null | undefined): string {
    if (!deviceType) return 'Unknown';
    return DEVICE_TYPE_LABELS[deviceType] || String(deviceType);
}

/** Options for `<select>` / combobox components (value + label). */
export const DEVICE_TYPE_OPTIONS = [
    { value: 'PHONE', label: 'Phone' },
    { value: 'TABLET', label: 'Tablet' },
    { value: 'DESKTOP', label: 'Desktop' },
    { value: 'SERVER', label: 'Server' },
    { value: 'EMBEDDED', label: 'Embedded' },
    { value: 'IOT', label: 'IoT Device' },
    { value: 'OTHER', label: 'Other' }
];

/**
 * Formats a timestamp for the viewer's locale (date + time).
 * @returns `"Never"` if missing; `"Invalid date"` on parse failure.
 */
export function formatDeviceDate(date: string | Date | null | undefined): string {
    if (!date) return 'Never';

    try {
        return new Date(date).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        });
    } catch {
        return 'Invalid date';
    }
}

/**
 * Relative time for recent activity (`Just now`, `3 minutes ago`, ...).
 * Falls back to {@link formatDeviceDate} after seven days.
 */
export function formatDeviceDateRelative(date: string | Date | null | undefined): string {
    if (!date) return 'Never';

    try {
        const dateObj = new Date(date);
        const now = new Date();
        const diffMs = now.getTime() - dateObj.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

        return formatDeviceDate(date);
    } catch {
        return 'Invalid date';
    }
}

// --- MAC / EUI-48 ---

/**
 * Normalizes a MAC string to uppercase groups separated by colons (e.g. `AA:BB:CC:DD:EE:FF`).
 * @returns `"N/A"` when `mac` is nullish. Non-12-hex input may not be a valid EUI-48.
 */
export function formatMacAddress(mac: string | null | undefined): string {
    if (!mac) return 'N/A';

    const cleaned = mac.replace(/[\s:.\-]/g, '').toUpperCase();
    return cleaned.match(/.{1,2}/g)?.join(':') || mac;
}

/**
 * Default display name when identity is a MAC: `device - AA:BB:CC:DD:EE:FF`.
 * Used for new device/sensor rows from claim and PIN flows.
 * @returns `"Unknown device"` when the value cannot be formatted as a MAC.
 */
export function deviceDisplayNameFromMac(macOrRaw: string | null | undefined): string {
    if (!macOrRaw?.trim()) return 'Unknown device';
    const formatted = formatMacAddress(macOrRaw);
    if (!formatted || formatted === 'N/A') return 'Unknown device';
    return `device - ${formatted}`;
}

/**
 * Returns both DB shapes for one NIC: colon-separated and 12-hex compact, deduplicated.
 * Use with Prisma `OR` and `mode: 'insensitive'` on string fields.
 * @returns `null` if the input is not exactly 12 hex digits after stripping separators.
 */
export function macQueryVariants(raw: string | null | undefined): string[] | null {
    if (!raw?.trim()) return null;
    const stripped = raw.trim().replace(/[\s:.\-]/g, '');
    if (!/^[0-9A-Fa-f]{12}$/i.test(stripped)) return null;
    const canonical = formatMacAddress(stripped);
    const compact = stripped.toUpperCase();
    return [...new Set([canonical, compact])];
}

/**
 * Value to store on `Device.macAddress`, `wifiMac`, or `lanMac`.
 * 12-hex input becomes colon-uppercase; otherwise returns trimmed raw string (legacy).
 */
export function normalizeMacForStorage(raw: string | null | undefined): string | null {
    if (!raw?.trim()) return null;
    const vars = macQueryVariants(raw);
    if (vars?.length) return vars[0];
    return raw.trim();
}

/**
 * Compact 12-hex uppercase string for `FactoryDevice.hardwareFingerprint` and PIN backfill.
 * @returns `null` unless the stripped input is exactly 12 hex characters.
 */
export function macHardwareFingerprint(raw: string | null | undefined): string | null {
    if (!raw?.trim()) return null;
    const stripped = raw.trim().replace(/[\s:.\-]/g, '');
    if (!/^[0-9A-Fa-f]{12}$/i.test(stripped)) return null;
    return stripped.toUpperCase();
}

/** User-visible online/offline string. */
export function getConnectionStatusDisplay(connected: boolean | null | undefined): string {
    if (connected === null || connected === undefined) return 'Unknown';
    return connected ? 'Online' : 'Offline';
}

/** Badge variant for connection indicator. */
export function getConnectionStatusVariant(
    connected: boolean | null | undefined
): 'success' | 'destructive' | 'secondary' {
    if (connected === null || connected === undefined) return 'secondary';
    return connected ? 'success' : 'destructive';
}
