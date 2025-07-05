/**
 * Client-side permission utility functions
 * These work with the data passed from server-side load functions
 */

export type AccountRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Check if the current user can perform admin actions within an account
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user has admin permissions
 */
export function canPerformAdminActions(currentAccount?: { userRole?: string }): boolean {
    if (!currentAccount?.userRole) return false;
    
    const userRole = currentAccount.userRole.toUpperCase() as AccountRole;
    return userRole === 'ADMIN' || userRole === 'OWNER';
}

/**
 * Check if the current user has a specific role or higher
 * @param requiredRole - The minimum required role
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user meets the role requirement
 */
export function hasAccountRole(requiredRole: AccountRole, currentAccount?: { userRole?: string }): boolean {
    if (!currentAccount?.userRole) return false;
    
    const userRole = currentAccount.userRole.toUpperCase() as AccountRole;
    
    // Define role hierarchy (higher number = more permissions)
    const roleHierarchy: Record<AccountRole, number> = {
        'MEMBER': 2,
        'ADMIN': 3,
        'OWNER': 4
    };
    
    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if the current user has any of the specified roles
 * @param roles - Array of acceptable roles
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user has any of the specified roles
 */
export function hasAnyAccountRole(roles: AccountRole[], currentAccount?: { userRole?: string }): boolean {
    if (!currentAccount?.userRole) return false;
    
    const userRole = currentAccount.userRole.toUpperCase() as AccountRole;
    return roles.includes(userRole);
}

/**
 * Check if the current user is the account owner
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user is the owner
 */
export function isAccountOwner(currentAccount?: { userRole?: string }): boolean {
    return hasAccountRole('OWNER', currentAccount) && currentAccount?.userRole?.toUpperCase() === 'OWNER';
}

/**
 * Check if the current user can edit account settings
 * Typically only ADMIN and OWNER roles can edit account settings
 * @param currentAccount - Account data with userRole property
 * @returns boolean indicating if user can edit account settings
 */
export function canEditAccount(currentAccount?: { userRole?: string }): boolean {
    return canPerformAdminActions(currentAccount);
}

/**
 * Get a user-friendly role display name
 * @param role - The role to format
 * @returns formatted role name
 */
export function formatRole(role?: string): string {
    if (!role) return 'Member';
    
    switch (role.toUpperCase()) {
        case 'OWNER': return 'Owner';
        case 'ADMIN': return 'Admin';
        case 'MEMBER': return 'Member';
        default: return role;
    }
} 
