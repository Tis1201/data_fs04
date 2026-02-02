/**
 * Preclaim-related utility functions
 * Shared across admin and user preclaim pages
 */

/**
 * Preclaim set status labels mapping
 */
export const PRECLAIM_STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    EXPIRED: 'Expired'
};

/**
 * Get preclaim status label (human-readable text)
 */
export function getPreclaimStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return PRECLAIM_STATUS_LABELS[status] || String(status);
}

/**
 * Get preclaim status badge variant for UI components
 */
export function getPreclaimStatusVariant(
    status: string | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (!status) return 'outline';

    const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
        ACTIVE: 'success',
        INACTIVE: 'secondary',
        EXPIRED: 'destructive'
    };

    return variantMap[status] || 'outline';
}

/**
 * Format date for display (in viewer's local timezone)
 */
export function formatPreclaimDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';

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
 * Check if preclaim set is expired
 */
export function isPreclaimExpired(expiresAt: string | Date | null | undefined): boolean {
    if (!expiresAt) return false;
    try {
        return new Date(expiresAt) < new Date();
    } catch {
        return false;
    }
}

