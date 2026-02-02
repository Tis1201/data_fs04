/**
 * Device-related utility functions
 * Shared across admin and user device pages
 */

/**
 * Device status labels mapping
 */
export const DEVICE_STATUS_LABELS: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    PENDING: 'Pending',
    OFFLINE: 'Offline',
    ONLINE: 'Online'
};

/**
 * Get device status label (human-readable text)
 */
export function getDeviceStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    return DEVICE_STATUS_LABELS[status] || String(status);
}

/**
 * Get device status badge variant for UI components
 */
export function getDeviceStatusVariant(
    status: string | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (!status) return 'outline';
    
    const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
        ACTIVE: 'success',      // Green
        INACTIVE: 'secondary',  // Gray
        PENDING: 'default',     // Primary blue
        OFFLINE: 'destructive',  // Red
        ONLINE: 'success'       // Green
    };
    
    return variantMap[status] || 'outline';
}

/**
 * Get CSS classes for device status text (for list views with colored text)
 */
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

/**
 * Device type labels mapping
 */
export const DEVICE_TYPE_LABELS: Record<string, string> = {
    PHONE: 'Phone',
    TABLET: 'Tablet',
    DESKTOP: 'Desktop',
    SERVER: 'Server',
    EMBEDDED: 'Embedded',
    IOT: 'IoT Device',
    OTHER: 'Other'
};

/**
 * Get device type display name
 */
export function getDeviceTypeDisplay(deviceType: string | null | undefined): string {
    if (!deviceType) return 'Unknown';
    return DEVICE_TYPE_LABELS[deviceType] || String(deviceType);
}

/**
 * Device type options for dropdowns/selects
 */
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
 * Format device date for display (in viewer's local timezone)
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
 * Format device date as relative time (e.g., "2 hours ago")
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
        
        // For older dates, use full format
        return formatDeviceDate(date);
    } catch {
        return 'Invalid date';
    }
}

/**
 * Format MAC address for display (uppercase with colons)
 */
export function formatMacAddress(mac: string | null | undefined): string {
    if (!mac) return 'N/A';
    
    // Remove any existing separators and convert to uppercase
    const cleaned = mac.replace(/[:-]/g, '').toUpperCase();
    
    // Add colons every 2 characters
    return cleaned.match(/.{1,2}/g)?.join(':') || mac;
}

/**
 * Get connection status display (online/offline)
 */
export function getConnectionStatusDisplay(connected: boolean | null | undefined): string {
    if (connected === null || connected === undefined) return 'Unknown';
    return connected ? 'Online' : 'Offline';
}

/**
 * Get connection status variant
 */
export function getConnectionStatusVariant(
    connected: boolean | null | undefined
): 'success' | 'destructive' | 'secondary' {
    if (connected === null || connected === undefined) return 'secondary';
    return connected ? 'success' : 'destructive';
}
