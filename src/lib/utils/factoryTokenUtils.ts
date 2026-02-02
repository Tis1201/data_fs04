/**
 * Factory token-related utility functions
 * Shared across admin factory token pages
 */

/**
 * Get status label
 */
export function getFactoryTokenStatusLabel(isUsed: boolean | null | undefined): string {
    if (isUsed === null || isUsed === undefined) return 'Unknown';
    return isUsed ? 'Used' : 'Available';
}

/**
 * Get status badge variant for UI components
 */
export function getFactoryTokenStatusVariant(
    isUsed: boolean | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (isUsed === null || isUsed === undefined) return 'outline';
    return isUsed ? 'success' : 'secondary';
}

/**
 * Format hardware model for display
 */
export function formatHardwareModel(hardwareModel: string | null | undefined): string {
    if (!hardwareModel) return 'N/A';
    return hardwareModel;
}

/**
 * Check if token is expired
 */
export function isFactoryTokenExpired(expiresAt: string | Date | null | undefined): boolean {
    if (!expiresAt) return false;
    try {
        return new Date(expiresAt) < new Date();
    } catch {
        return false;
    }
}

/**
 * Format date for display (in viewer's local timezone)
 */
export function formatFactoryTokenDate(date: string | Date | null | undefined): string {
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

