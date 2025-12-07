/**
 * Resource-related utility functions
 * Shared across admin resource pages
 */

/**
 * Resource type labels mapping
 */
export const RESOURCE_TYPE_LABELS: Record<string, string> = {
    file: 'File',
    image: 'Image',
    video: 'Video',
    document: 'Document',
    binary: 'Binary',
    application: 'Application',
    archive: 'Archive',
    package: 'Package'
};

/**
 * Get resource type label (human-readable text)
 */
export function getResourceTypeLabel(type: string | null | undefined): string {
    if (!type) return 'Unknown';
    return RESOURCE_TYPE_LABELS[type] || String(type);
}

/**
 * Resource target labels mapping
 */
export const RESOURCE_TARGET_LABELS: Record<string, string> = {
    user: 'User',
    device: 'Device',
    account: 'Account'
};

/**
 * Get resource target label (human-readable text)
 */
export function getResourceTargetLabel(target: string | null | undefined): string {
    if (!target) return 'Unknown';
    return RESOURCE_TARGET_LABELS[target] || String(target);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get format badge variant for UI components
 */
export function getFormatBadgeVariant(
    format: string | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (!format) return 'outline';

    const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
        apk: 'success',
        zip: 'default',
        bin: 'secondary',
        exe: 'destructive',
        sh: 'outline'
    };

    return variantMap[format.toLowerCase()] || 'outline';
}

/**
 * Format date for display (in viewer's local timezone)
 */
export function formatResourceDate(date: string | Date | null | undefined): string {
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

