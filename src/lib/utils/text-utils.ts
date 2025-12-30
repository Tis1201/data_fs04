/**
 * Text utility functions
 */

/**
 * Truncate text to a specified length
 */
export function truncateText(text: string, maxLength: number = 50): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Truncate email for display
 */
export function truncateEmail(email: string, maxLength: number = 30): string {
    if (!email) return '';
    if (email.length <= maxLength) return email;
    
    const [localPart, domain] = email.split('@');
    if (!domain) return truncateText(email, maxLength);
    
    const availableLength = maxLength - domain.length - 4; // 4 for "...@"
    if (availableLength <= 0) return truncateText(email, maxLength);
    
    return localPart.substring(0, availableLength) + '...@' + domain;
}
