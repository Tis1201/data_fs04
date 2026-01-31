/**
 * Format bytes as human-readable text.
 * 
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use 
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 * @returns Formatted string.
 */
export function formatBytes(bytes: number, si = true, dp = 1) {
    if (bytes === 0) return '0 B';

    const k = si ? 1000 : 1024;
    const dm = dp < 0 ? 0 : dp;
    const sizes = si 
        ? ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format a date to a more readable format
 * @param date - Date object or date string to format
 * @returns Formatted date string or 'N/A' if date is falsy
 */
export function formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/** Options for table date/time: "Sep 01, 2025 09:49 AM" */
const TABLE_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
};

/**
 * Standard format for all date/time cells in DataTable: "Sep 01, 2025 09:49 AM"
 * @param value - Date, string, or number (timestamp)
 * @returns Formatted string or '-' if falsy
 */
export function formatTableDateTime(value: Date | string | number | null | undefined): string {
    if (value == null || value === '') return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const s = new Intl.DateTimeFormat('en-US', TABLE_DATETIME_OPTIONS).format(date);
    return s.replace(/, (\d{1,2}:\d{2}\s*[AP]M)$/i, ' $1');
}
