/**
 * System-wide role and user status definitions
 * This file serves as a central location for role-related enums and types
 */

// Define the available system roles
export enum SystemRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    USER = 'USER'
}

// Define the available user statuses
export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED'
}
