/**
 * Truncates text to a specified length and adds an ellipsis
 * @param text The text to truncate
 * @param maxLength The maximum length before truncation
 * @returns The truncated text
 */
export function truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Truncates an email address intelligently, preserving domain visibility
 * @param email The email to truncate
 * @param maxLength The maximum length before truncation
 * @returns The truncated email
 */
export function truncateEmail(email: string | null | undefined, maxLength: number): string {
    if (!email) return '';
    if (email.length <= maxLength) return email;

    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
        // Not an email, just truncate
        return email.substring(0, maxLength) + '...';
    }

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    // Try to preserve domain
    if (domain.length >= maxLength - 3) {
        // Domain is too long, just truncate
        return email.substring(0, maxLength) + '...';
    }

    const availableForLocal = maxLength - domain.length - 3; // "..." length
    if (availableForLocal <= 0) {
        return email.substring(0, maxLength) + '...';
    }

    return localPart.substring(0, availableForLocal) + '...' + domain;
}
