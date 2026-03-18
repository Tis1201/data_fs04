/**
 * Utility functions for Device Details page
 * Extracted to reduce file size and improve maintainability
 */

// ============================================================================
// Date Formatting Functions
// ============================================================================

/**
 * Parse a date string from server/ClickHouse as UTC.
 * ClickHouse returns "2026-03-17 16:18:59.506" (UTC, no Z) which JS otherwise parses as local time.
 */
export function parseAsUtc(date: string | Date | null): Date | null {
    if (!date) return null;
    if (date instanceof Date) return date;
    const s = String(date).trim();
    if (!s) return null;
    // Already has timezone: Z or +HH:MM / -HH:MM
    if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }
    const utcStr = s.replace(' ', 'T') + 'Z';
    const d = new Date(utcStr);
    return isNaN(d.getTime()) ? null : d;
}

export function formatDeploymentDate(dateString: string | null): string {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${month} ${day}, ${year} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

export function formatActivityLogDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${month}/${day}/${year} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

export function formatInstallDate(dateString: string, timezone?: string): string {
    if (!dateString) return 'N/A';

    // Ensure properly parsed as UTC if no timezone offset is provided
    const utcString = dateString.endsWith('Z') || dateString.includes('+')
        ? dateString
        : dateString.replace(' ', 'T') + 'Z';

    const d = new Date(utcString);
    if (isNaN(d.getTime())) return 'N/A';

    try {
        if (timezone && timezone !== '-') {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                month: 'short', day: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
            const parts = formatter.formatToParts(d);
            const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
            return `${p.month} ${p.day}, ${p.year} ${p.hour}:${p.minute} ${p.dayPeriod}`;
        }
    } catch (e) {
        console.warn('Invalid timezone:', timezone);
    }

    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
    const hour12 = d.getHours() % 12 || 12;
    return `${month} ${day}, ${year} ${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

export function formatLastSeen(date: string | Date | null): string {
    const d = parseAsUtc(date);
    if (!d) return 'N/A';
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate().toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${month} ${day}, ${year} ${hours}:${minutes}`;
}

/**
 * Format timestamp as relative time (e.g. "just now", "2 min ago") for recent dates.
 * Falls back to absolute format for older dates.
 */
export function formatRelativeTime(date: string | Date | null): string {
    const d = parseAsUtc(date);
    if (!d) return 'N/A';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMs < 0) return formatLastSeen(date); // Future: show absolute
    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return 'a few seconds ago';
    if (diffMin < 2) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 2) return '1 hour ago';
    if (diffHour < 24) return `${diffHour} hours ago`;
    if (diffDay < 2) return '1 day ago';
    if (diffDay < 7) return `${diffDay} days ago`;
    return formatLastSeen(date);
}

export function formatUptime(seconds: number | null): string {
    if (!seconds) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number | null): string {
    if (bytes === null || bytes === undefined) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ============================================================================
// Status Color Helpers
// ============================================================================

export function getDeploymentStatusColor(status: string): { bg: string; dot: string; text: string } {
    switch (status) {
        case 'Draft': return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
        case 'Scheduled': return { bg: '#EFF8FF', dot: '#2E90FA', text: '#175CD3' };
        case 'In Progress': return { bg: '#EFF8FF', dot: '#2E90FA', text: '#175CD3' };
        case 'Completed': return { bg: '#ECFDF3', dot: '#12B76A', text: '#027A48' };
        case 'Failed': return { bg: '#FEF3F2', dot: '#F04438', text: '#B42318' };
        case 'Stopped': return { bg: '#FFFAEB', dot: '#F79009', text: '#B54708' };
        case 'Cancelled': return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
        default: return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
    }
}

export function getActivityLogStatusColor(status: 'Success' | 'In Progress' | 'Failed' | 'Warning'): { bg: string; dot: string; text: string } {
    switch (status) {
        case 'Success': return { bg: '#ECFDF3', dot: '#12B76A', text: '#027A48' };
        case 'In Progress': return { bg: '#EFF8FF', dot: '#2E90FA', text: '#175CD3' };
        case 'Failed': return { bg: '#FEF3F2', dot: '#F04438', text: '#B42318' };
        case 'Warning': return { bg: '#FFFAEB', dot: '#F79009', text: '#B54708' };
        default: return { bg: '#F5F5F5', dot: '#737373', text: '#525252' };
    }
}

// Map deployment status to Badge color
export function getDeploymentBadgeColor(status: string): 'success' | 'error' | 'warning' | 'blue' | 'gray' {
    switch (status) {
        case 'Completed': return 'success';
        case 'Failed': return 'error';
        case 'Stopped': return 'warning';
        case 'In Progress':
        case 'Scheduled': return 'blue';
        default: return 'gray';
    }
}

// Map activity log status to Badge color
export function getActivityLogBadgeColor(status: 'Success' | 'In Progress' | 'Failed' | 'Warning'): 'success' | 'error' | 'warning' | 'blue' {
    switch (status) {
        case 'Success': return 'success';
        case 'Failed': return 'error';
        case 'Warning': return 'warning';
        case 'In Progress': return 'blue';
        default: return 'blue';
    }
}

export function getAppTypeBadgeColor(type: string): { bg: string; text: string } {
    switch ((type || '').toLowerCase()) {
        case 'system': return { bg: '#FEF3F2', text: '#B42318' };
        case 'normal': return { bg: '#EFF8FF', text: '#175CD3' };
        case 'user': return { bg: '#ECFDF3', text: '#027A48' };
        default: return { bg: '#F5F5F5', text: '#525252' };
    }
}

export function getUsageColor(usage: number | null): string {
    if (usage === null || usage === undefined) return '#A3A3A3';
    if (usage < 60) return '#039855';
    if (usage < 80) return '#DC6803';
    return '#D92D20';
}

// ============================================================================
// Status Mapping Functions
// ============================================================================

export function mapBundleStatus(status: string): string {
    const statusMap: Record<string, string> = {
        'DRAFT': 'Draft',
        'PUBLISHED': 'Scheduled',
        'PENDING': 'Scheduled',
        'IN_PROGRESS': 'In Progress',
        'COMPLETED': 'Completed',
        'FAILED': 'Failed',
        'CANCELLED': 'Cancelled',
        'STOPPED': 'Stopped',
        'INCLUDED': 'Scheduled',
        'EXCLUDED': 'Cancelled'
    };
    return statusMap[status?.toUpperCase()] || status || 'Unknown';
}

export function mapActionStatus(status: string): 'Success' | 'In Progress' | 'Failed' | 'Warning' {
    const statusMap: Record<string, 'Success' | 'In Progress' | 'Failed' | 'Warning'> = {
        'success': 'Success',
        'completed': 'Success',
        'failed': 'Failed',
        'error': 'Failed',
        'in_progress': 'In Progress',
        'pending': 'In Progress',
        'warning': 'Warning'
    };
    return statusMap[status?.toLowerCase()] || 'In Progress';
}

export function formatActionDescription(actionType: string, message?: string): string {
    if (message) {
        // For timeout/failure messages, prefix with action type so user knows which action failed
        if (
            (message.includes('timeout') || message.includes('did not respond')) &&
            actionType
        ) {
            return `${formatActionTypeLabel(actionType)}: ${message}`;
        }
        return message;
    }

    const descriptions: Record<string, string> = {
        'reboot': 'Rebooted device',
        'restart': 'Restarted device',
        'refresh': 'Refreshed device',
        'screenshot': 'Captured screenshot',
        'install_app': 'Installed application',
        'uninstall_app': 'Uninstalled application',
        'restart_app': 'Restarted application',
        'push_file': 'Pushed file to device',
        'pull_file': 'Pulled file from device',
        'update_firmware': 'Updated firmware',
        'config_app': 'Configured application',
        'get_logs': 'Retrieved device logs'
    };

    return descriptions[actionType] || `Action: ${actionType}`;
}

/** Human-readable action type for activity log details (e.g. "Terminal", "Remote Desktop (RDP)") */
export function formatActionTypeLabel(actionType: string): string {
    const labels: Record<string, string> = {
        terminal: 'Terminal',
        remote_desktop: 'Remote Desktop (RDP)',
        refresh: 'Refresh',
        screenshot: 'Screenshot',
        snapshot: 'Snapshot',
        reboot: 'Reboot',
        restart: 'Restart',
        install_app: 'Install app',
        uninstall_app: 'Uninstall app',
        push_file: 'Push file',
        pull_file: 'Pull file',
        get_logs: 'Download logs',
    };
    return labels[actionType] || actionType.replace(/_/g, ' ');
}
