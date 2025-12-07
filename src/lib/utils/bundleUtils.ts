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
    FAILED: 'Failed'
};

/**
 * Get bundle status label (human-readable text)
 */
export function getBundleStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return BUNDLE_STATUS_LABELS[status] || String(status);
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
        FAILED: 'destructive'       // Red
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
        FAILED: 'text-red-600'
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
        FAILED: 'text-red-700 border-red-200'
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
            minute: 'numeric',
            timeZoneName: 'short'
        });
    } catch {
        return 'Invalid date';
    }
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
            timeZone: timezone,
            timeZoneName: 'short'
        });
    } catch {
        return '';
    }
}

