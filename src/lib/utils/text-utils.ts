/**
 * Text Utilities for consistent text handling across the application
 * @module TextUtils
 */

/**
 * Truncate text to a given length
 * @param text - The text to truncate
 * @param maxLength - The maximum length of the text
 * @param suffix 
 * @returns The truncated text
 */
export function truncateText(text: string | null | undefined, maxLength: number = 40, suffix: string = '...'): string{
    //Handle null or undefined cases 
    if (!text) return '';
    
    //Convert to string if needed
    const str = String(text);

    //If the string is shorter than the max length, return it
    if (str.length <= maxLength) return str;

    //Return the truncated text
    return str.substring(0, maxLength) + suffix;
}

/**
 * Truncates email addresses intelligently
 * Keeps domain visible when possible
 * @param email - The email address to truncate
 * @param maxLength - The maximum length of the email address
 * @returns The truncated email address
 */
export function truncateEmail(email: string | null | undefined, maxLength: number = 30): string{
    //Handle null or undefined cases
    if (!email) return '';

    //Convert to string if needed
    const str = String(email);

    //If the string is shorter than the max length, return it
    if (str.length <= maxLength) return str;

    const atIndex = str.indexOf('@');
    if  (atIndex === -1) return truncateText(str, maxLength);

    const localPart = str.substring(0, atIndex);
    const domainPart = str.substring(atIndex);

    //If domain alone is too long, just truncate normally
    if (domainPart.length >= maxLength - 5 ) return truncateText(str, maxLength);

    //Truncate local part, keep domain
    const availableLength = maxLength - domainPart.length - 3;
    if (availableLength <=3) return truncateText(str, maxLength);

    //Return the truncated email address
    return localPart.substring(0, availableLength) + '...' + domainPart;
}
