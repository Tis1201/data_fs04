/**
 * Bundle-related utility functions
 * Shared across admin and user bundle pages
 */

/**
 * Bundle status labels mapping
 */
export const BUNDLE_STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    IN_PROGRESS: 'In Progress',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    STOPPED: 'Stopped'
};

/**
 * Get bundle status label (human-readable text)
 */
export function getBundleStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return BUNDLE_STATUS_LABELS[status] || String(status);
}

/**
 * Design-system Badge color for bundle status (Figma: Draft=gray, Scheduled=blue, In Progress=warning, Completed=success, Failed=error, Cancelled=error)
 */
export type BundleStatusBadgeColor = 'gray' | 'blue-light' | 'warning' | 'success' | 'error';

export function getBundleStatusBadgeColor(
    status: string | null | undefined,
    _row?: { scheduledAt?: Date | string | null }
): BundleStatusBadgeColor {
    if (!status) return 'gray';
    const s = String(status).toUpperCase();
    if (s === 'DRAFT') return 'gray';
    if (s === 'PUBLISHED') return 'blue-light'; // Scheduled
    if (s === 'IN_PROGRESS') return 'warning';
    if (s === 'COMPLETED') return 'success';
    if (s === 'FAILED' || s === 'CANCELLED') return 'error';
    if (s === 'STOPPED') return 'warning';
    return 'gray';
}

/**
 * Display label for list/detail (Figma: PUBLISHED with scheduledAt = "Scheduled", else "Published")
 */
export function getBundleStatusDisplayLabel(
    status: string | null | undefined,
    row?: { scheduledAt?: Date | string | null }
): string {
    const s = String(status || '').toUpperCase();
    if (s === 'PUBLISHED' && row?.scheduledAt) return 'Scheduled';
    return getBundleStatusLabel(status);
}

/**
 * Get bundle status badge variant for UI components
 */
export function getBundleStatusVariant(
    status: string | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (!status) return 'outline';
    
    const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
        DRAFT: 'outline',
        PUBLISHED: 'secondary',      // Neutral gray
        IN_PROGRESS: 'default',     // Primary blue
        CANCELLED: 'destructive',   // Red
        COMPLETED: 'success',       // Green
        FAILED: 'destructive',      // Red
        STOPPED: 'default'          // Warning / paused
    };
    
    return variantMap[status] || 'outline';
}

/**
 * Get CSS classes for status text (for list views with colored text)
 */
export function getBundleStatusTextClass(status: string | null | undefined): string {
    if (!status) return 'text-muted-foreground';
    
    const classMap: Record<string, string> = {
        DRAFT: 'text-muted-foreground',
        PUBLISHED: 'text-blue-600',
        IN_PROGRESS: 'text-blue-600',
        CANCELLED: 'text-red-600',
        COMPLETED: 'text-green-600',
        FAILED: 'text-red-600',
        STOPPED: 'text-amber-600'
    };
    
    return classMap[status] || 'text-muted-foreground';
}

/**
 * Get CSS classes for status text with border (for list views)
 */
export function getStatusTextBorderClasses(status: string | null | undefined): string {
    if (!status) return 'text-zinc-700 border-zinc-200';
    
    const classMap: Record<string, string> = {
        DRAFT: 'text-zinc-900 border-zinc-200',
        PUBLISHED: 'text-zinc-700 border-zinc-300',
        IN_PROGRESS: 'text-blue-700 border-blue-300',
        CANCELLED: 'text-red-700 border-red-200',
        COMPLETED: 'text-green-700 border-green-200',
        FAILED: 'text-red-700 border-red-200',
        STOPPED: 'text-amber-700 border-amber-200'
    };
    
    return classMap[status] || 'text-zinc-800 border-zinc-200';
}

/**
 * OS display names mapping
 */
export const OS_DISPLAY_NAMES: Record<string, string> = {
    ANDROID: 'Android',
    IOS: 'iOS',
    WINDOWS: 'Windows',
    LINUX: 'Linux',
    MACOS: 'macOS'
};

/**
 * Get OS display name
 */
export function getOSDisplay(os: string | null | undefined): string {
    if (!os) return 'Unknown';
    return OS_DISPLAY_NAMES[os] || String(os);
}

/**
 * Device type aliases per bundle OS (devices report "darwin", bundles use "MacOS")
 */
const BUNDLE_OS_DEVICE_ALIASES: Record<string, string[]> = {
    MACOS: ['darwin', 'macos'],
    DARWIN: ['darwin', 'macos'],
    LINUX: ['linux'],
    WINDOWS: ['windows'],
    ANDROID: ['android'],
    WEBOS: ['webos']
};

/**
 * Check if a device's deviceType matches the bundle's target OS.
 * Handles darwin↔MacOS, case-insensitive.
 */
export function deviceTypeMatchesBundleOs(
    deviceType: string | null | undefined,
    bundleOs: string | null | undefined
): boolean {
    const dt = (deviceType ?? '').trim();
    const bo = (bundleOs ?? '').trim();
    if (!bo) return true;
    if (!dt) return false;
    const dtLower = dt.toLowerCase();
    const boUpper = bo.toUpperCase();
    if (dtLower === bo.toLowerCase()) return true;
    const aliases = BUNDLE_OS_DEVICE_ALIASES[boUpper];
    if (aliases) return aliases.some((a) => dtLower === a.toLowerCase());
    return dtLower === bo.toLowerCase();
}

/**
 * Display name for device type (darwin → MacOS, etc.)
 */
export function getDeviceTypeDisplayName(deviceType: string | null | undefined): string {
    const dt = (deviceType ?? '').trim().toUpperCase();
    if (!dt) return '—';
    if (dt === 'DARWIN') return 'MacOS';
    if (dt === 'MACOS') return 'MacOS';
    if (dt === 'LINUX') return 'Linux';
    if (dt === 'WINDOWS') return 'Windows';
    if (dt === 'ANDROID') return 'Android';
    if (dt === 'WEBOS') return 'WebOS';
    return deviceType ?? '—';
}

/**
 * Returns Prisma deviceType filter for bundle OS (darwin matches MacOS, etc.).
 * Use when filtering devices by bundle target OS.
 */
export function getDeviceTypeFilterForBundleOs(bundleOs: string | null | undefined): { deviceType: { in: string[]; mode: 'insensitive' } } | null {
    const bo = (bundleOs ?? '').trim();
    if (!bo) return null;
    const aliases = BUNDLE_OS_DEVICE_ALIASES[bo.toUpperCase()];
    if (aliases?.length) {
        return { deviceType: { in: aliases, mode: 'insensitive' } };
    }
    return { deviceType: { in: [bo], mode: 'insensitive' } };
}

/**
 * OS options for dropdowns/selects
 */
export const OS_OPTIONS = [
    { value: 'ANDROID', label: 'Android' },
    { value: 'IOS', label: 'iOS' },
    { value: 'WINDOWS', label: 'Windows' },
    { value: 'LINUX', label: 'Linux' },
    { value: 'MACOS', label: 'macOS' }
];

/**
 * Format bundle date for display (in viewer's local timezone)
 */
export function formatBundleDate(date: string | Date | null | undefined): string {
    if (!date) return 'Not scheduled';
    
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
 * Format end-on date from scheduledAt + activePeriodDays (for deployment overview)
 */
export function formatBundleEndOn(
    scheduledAt: string | Date | null | undefined,
    activePeriodDays: number | null | undefined
): string {
    if (!scheduledAt) return '—';
    const days = Math.min(Math.max(Number(activePeriodDays) || 1, 1), 30);
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    return formatBundleDate(end);
}

/**
 * Format bundle date with specific timezone
 */
export function formatBundleDateWithTimezone(
    date: string | Date | null | undefined,
    timezone: string | null | undefined
): string {
    if (!date || !timezone) return '';
    
    try {
        return new Date(date).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZone: timezone
        });
    } catch {
        return '';
    }
}

