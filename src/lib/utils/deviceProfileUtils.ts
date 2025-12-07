/**
 * Device Profile-related utility functions
 * Shared across admin and user device profile pages
 */

/**
 * Device profile status labels mapping
 */
export const DEVICE_PROFILE_STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive'
};

/**
 * Get device profile status label (human-readable text)
 */
export function getDeviceProfileStatusLabel(isActive: boolean | null | undefined): string {
    if (isActive === null || isActive === undefined) return 'Unknown';
    return isActive ? DEVICE_PROFILE_STATUS_LABELS.ACTIVE : DEVICE_PROFILE_STATUS_LABELS.INACTIVE;
}

/**
 * Get device profile status badge variant for UI components
 */
export function getDeviceProfileStatusVariant(
    isActive: boolean | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (isActive === null || isActive === undefined) return 'outline';

    const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
        'true': 'success',   // Active - Green
        'false': 'secondary' // Inactive - Gray
    };

    return variantMap[String(isActive)] || 'outline';
}

/**
 * Format date for display (in viewer's local timezone)
 */
export function formatDeviceProfileDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';

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
 * Format assignment count for display
 */
export function formatAssignmentCount(count: number | null | undefined): string {
    if (count === null || count === undefined) return '0';
    return count.toString();
}

