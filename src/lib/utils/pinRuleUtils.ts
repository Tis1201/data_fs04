/**
 * Pin rule-related utility functions
 * Shared across admin and user pin rule pages
 */

/**
 * Pin rule type labels mapping
 */
export const PIN_RULE_TYPE_LABELS: Record<string, string> = {
    admin_default: 'Admin default',
    admin_custom: 'Admin custom',
    user_default: 'User default',
    user_custom: 'User custom'
};

/**
 * Get pin rule type label (human-readable text)
 */
export function getPinRuleTypeLabel(ruleType: string | null | undefined): string {
    if (!ruleType) return 'Unknown';
    return PIN_RULE_TYPE_LABELS[ruleType] || String(ruleType);
}

/**
 * Get pin rule type badge variant for UI components
 */
export function getPinRuleTypeBadgeVariant(
    ruleType: string | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (!ruleType) return 'outline';

    const variantMap: Record<string, 'outline' | 'default' | 'destructive' | 'success' | 'secondary'> = {
        admin_default: 'success',
        admin_custom: 'default',
        user_default: 'secondary',
        user_custom: 'outline'
    };

    return variantMap[ruleType] || 'outline';
}

/**
 * Get status label
 */
export function getPinRuleStatusLabel(isActive: boolean | null | undefined): string {
    if (isActive === null || isActive === undefined) return 'Unknown';
    return isActive ? 'Active' : 'Inactive';
}

/**
 * Get status badge variant for UI components
 */
export function getPinRuleStatusVariant(
    isActive: boolean | null | undefined
): 'outline' | 'default' | 'destructive' | 'success' | 'secondary' {
    if (isActive === null || isActive === undefined) return 'outline';
    return isActive ? 'success' : 'secondary';
}

/**
 * Format target type for display
 */
export function formatPinRuleTargetType(targetType: string | null | undefined): string {
    if (!targetType) return 'All Devices';
    
    const typeMap: Record<string, string> = {
        all: 'All Devices',
        tags: 'Tags',
        os: 'OS',
        devices: 'Devices'
    };
    
    return typeMap[targetType] || String(targetType);
}

/**
 * Format apps array for display
 */
export function formatPinRuleApps(apps: string[] | null | undefined): string {
    if (!apps || apps.length === 0) return 'No apps';
    if (apps.length === 1) return apps[0];
    return `${apps.length} apps`;
}

/**
 * Format date for display (in viewer's local timezone)
 */
export function formatPinRuleDate(date: string | Date | null | undefined): string {
    if (!date) return 'N/A';

    try {
        return new Date(date).toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZoneName: 'short'
        });
    } catch {
        return 'Invalid date';
    }
}

