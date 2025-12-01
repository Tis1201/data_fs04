/**
 * Device-related utility functions
 * Shared across admin and user device detail pages
 */

export const LICENSE_STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Active',
    REVOKED: 'Revoked',
    EXPIRED: 'Expired',
    SUSPENDED: 'Suspended'
};

/**
 * Convert snake_case to Title Case
 */
export function toTitleCaseFromSnake(input: string): string {
    return (input || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get license status label
 */
export function getLicenseStatusLabel(status: string): string {
    return LICENSE_STATUS_LABELS[status] ?? status;
}

/**
 * Get license status badge variant
 */
export function getLicenseStatusBadgeVariant(status: string): 'success' | 'destructive' | 'secondary' | 'outline' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'revoked') return 'destructive';
    if (s === 'expired') return 'secondary';
    if (s === 'suspended') return 'outline';
    return 'outline';
}

/**
 * Extract filename from object path
 */
export function extractFileNameFromPath(objectPath: string): string {
    const parts = objectPath.split('/');
    return parts[parts.length - 1] || 'file';
}

/**
 * Get connection status badge
 */
export function getConnectionStatusBadge(connected: boolean): { label: string; variant: 'success' | 'destructive' } {
    return connected
        ? { label: "Connected", variant: "success" as const }
        : { label: "Disconnected", variant: "destructive" as const };
}

/**
 * Format device status
 */
export function formatDeviceStatus(s: string | null | undefined): string {
    return s ? s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';
}

