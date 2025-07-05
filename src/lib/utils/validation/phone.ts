/**
 * Phone number validation utilities using libphonenumber-js
 * Supports comprehensive international phone number formats
 */

import { parsePhoneNumberWithError, isValidPhoneNumber } from 'libphonenumber-js';

/**
 * Validates a phone number using libphonenumber-js
 * @param phone - Phone number string to validate
 * @returns boolean indicating if phone number is valid
 */
export function validatePhoneNumber(phone: string): boolean {
    if (!phone || phone.trim().length === 0) {
        return true; // Allow empty phone numbers
    }
    
    try {
        // Use libphonenumber-js for comprehensive validation
        return isValidPhoneNumber(phone.trim());
    } catch (error) {
        // If parsing fails, the number is invalid
        return false;
    }
}

/**
 * Get user-friendly error message for invalid phone numbers
 * @returns string with examples of valid formats
 */
export function getPhoneValidationMessage(): string {
    return "Please enter a valid phone number. Examples: +1 555-123-4567, (555) 123-4567, +44 20 7946 0958, +33 1 42 86 83 26";
}

/**
 * Parse and format a phone number
 * @param phone - Raw phone number
 * @param defaultCountry - Default country code (e.g., 'US', 'GB')
 * @returns formatted phone number or original if parsing fails
 */
export function formatPhoneNumber(phone: string, defaultCountry?: string): string {
    if (!phone) return phone;
    
    try {
        const phoneNumber = parsePhoneNumberWithError(phone, defaultCountry as any);
        if (phoneNumber && phoneNumber.isValid()) {
            return phoneNumber.formatInternational();
        }
    } catch (error) {
        // If parsing fails, return original
    }
    
    return phone;
}

/**
 * Get phone number details including country and type
 * @param phone - Phone number to analyze
 * @param defaultCountry - Default country code
 * @returns object with phone number details or null if invalid
 */
export function getPhoneNumberDetails(phone: string, defaultCountry?: string) {
    if (!phone || phone.trim().length === 0) {
        return null;
    }
    
    try {
        const phoneNumber = parsePhoneNumberWithError(phone.trim(), defaultCountry as any);
        if (phoneNumber && phoneNumber.isValid()) {
            return {
                isValid: true,
                formatted: phoneNumber.formatInternational(),
                national: phoneNumber.formatNational(),
                e164: phoneNumber.format('E.164'),
                country: phoneNumber.country,
                countryCallingCode: phoneNumber.countryCallingCode,
                nationalNumber: phoneNumber.nationalNumber,
                type: phoneNumber.getType(), // mobile, fixed-line, etc.
                isPossible: phoneNumber.isPossible()
            };
        }
    } catch (error) {
        // If parsing fails, return invalid result
    }
    
    return {
        isValid: false,
        formatted: phone,
        national: phone,
        e164: phone,
        country: null,
        countryCallingCode: null,
        nationalNumber: null,
        type: null,
        isPossible: false
    };
} 
