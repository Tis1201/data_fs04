/**
 * Navigation utility functions
 * Shared across admin and user routes
 */

export type BreadcrumbItem = [string, string];

/**
 * Get breadcrumbs for bundle list page
 */
export function getBundleListBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    if (context === 'admin') {
        return [
            ["Admin", "/admin"],
            ["IOT", ""],
            ["Bundles", "/admin/iot/bundles"]
        ];
    } else {
        return [
            ["HOME", "/user"],
            ["IOT", ""],
            ["Bundles", "/user/iot/bundles"]
        ];
    }
}

/**
 * Get breadcrumbs for bundle detail page
 */
export function getBundleDetailBreadcrumbs(
    context: 'admin' | 'user',
    bundleName?: string | null
): BreadcrumbItem[] {
    const baseBreadcrumbs = getBundleListBreadcrumbs(context);
    const bundleLabel = bundleName || "Bundle";
    
    return [
        ...baseBreadcrumbs,
        [bundleLabel, ""]
    ];
}

/**
 * Get breadcrumbs for bundle edit page
 */
export function getBundleEditBreadcrumbs(
    context: 'admin' | 'user',
    bundleName?: string | null,
    bundleId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getBundleListBreadcrumbs(context);
    const bundleLabel = bundleName || "Bundle";
    const bundlePath = context === 'admin' 
        ? `/admin/iot/bundles/${bundleId}`
        : `/user/iot/bundles/${bundleId}`;
    
    return [
        ...baseBreadcrumbs,
        [bundleLabel, bundlePath],
        ["Edit", ""]
    ];
}

/**
 * Get breadcrumbs for bundle new/create page
 */
export function getBundleNewBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    const baseBreadcrumbs = getBundleListBreadcrumbs(context);
    
    return [
        ...baseBreadcrumbs,
        ["New Bundle", ""]
    ];
}

/**
 * Get breadcrumbs for device list page
 */
export function getDeviceListBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    if (context === 'admin') {
        return [
            ["Admin", "/admin"],
            ["IOT", ""],
            ["Devices", "/admin/iot/devices"]
        ];
    } else {
        return [
            ["HOME", "/user"],
            ["IOT", ""],
            ["Devices", "/user/iot/devices"]
        ];
    }
}

/**
 * Get breadcrumbs for device detail page
 */
export function getDeviceDetailBreadcrumbs(
    context: 'admin' | 'user',
    deviceName?: string | null
): BreadcrumbItem[] {
    const baseBreadcrumbs = getDeviceListBreadcrumbs(context);
    const deviceLabel = deviceName || "Device";
    
    return [
        ...baseBreadcrumbs,
        [deviceLabel, ""]
    ];
}

/**
 * Get breadcrumbs for device edit page
 */
export function getDeviceEditBreadcrumbs(
    context: 'admin' | 'user',
    deviceName?: string | null,
    deviceId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getDeviceListBreadcrumbs(context);
    const deviceLabel = deviceName || "Device";
    const devicePath = context === 'admin' 
        ? `/admin/iot/devices/${deviceId}`
        : `/user/iot/devices/${deviceId}`;
    
    return [
        ...baseBreadcrumbs,
        [deviceLabel, devicePath],
        ["Edit", ""]
    ];
}

/**
 * Get breadcrumbs for device new/create page
 */
export function getDeviceNewBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    const baseBreadcrumbs = getDeviceListBreadcrumbs(context);
    
    return [
        ...baseBreadcrumbs,
        ["New Device", ""]
    ];
}

/**
 * Get breadcrumbs for device profile list page
 */
export function getDeviceProfileListBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    if (context === 'admin') {
        return [
            ["Admin", "/admin"],
            ["IOT", ""],
            ["Device Profiles", "/admin/iot/device-profiles"]
        ];
    } else {
        return [
            ["HOME", "/user"],
            ["IOT", ""],
            ["Device Profiles", "/user/iot/device-profiles"]
        ];
    }
}

/**
 * Get breadcrumbs for device profile detail page
 */
export function getDeviceProfileDetailBreadcrumbs(
    context: 'admin' | 'user',
    profileName?: string | null,
    profileId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getDeviceProfileListBreadcrumbs(context);
    const profileLabel = profileName || "Device Profile";
    const profilePath = context === 'admin'
        ? `/admin/iot/device-profiles/${profileId}`
        : `/user/iot/device-profiles/${profileId}`;

    return [
        ...baseBreadcrumbs,
        [profileLabel, profilePath]
    ];
}

/**
 * Get breadcrumbs for device profile edit page
 */
export function getDeviceProfileEditBreadcrumbs(
    context: 'admin' | 'user',
    profileName?: string | null,
    profileId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getDeviceProfileListBreadcrumbs(context);
    const profileLabel = profileName || "Device Profile";
    const profilePath = context === 'admin'
        ? `/admin/iot/device-profiles/${profileId}`
        : `/user/iot/device-profiles/${profileId}`;

    return [
        ...baseBreadcrumbs,
        [profileLabel, profilePath],
        ["Edit", ""]
    ];
}

/**
 * Get breadcrumbs for device profile new/create page
 */
export function getDeviceProfileNewBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    const baseBreadcrumbs = getDeviceProfileListBreadcrumbs(context);

    return [
        ...baseBreadcrumbs,
        ["New Device Profile", ""]
    ];
}

/**
 * Get breadcrumbs for preclaim list page
 */
export function getPreclaimListBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    if (context === 'admin') {
        return [
            ["Admin", "/admin"],
            ["IOT", ""],
            ["Preclaims", "/admin/iot/preclaims"]
        ];
    } else {
        return [
            ["HOME", "/user"],
            ["IOT", ""],
            ["Preclaims", "/user/iot/preclaims"]
        ];
    }
}

/**
 * Get breadcrumbs for preclaim detail page
 */
export function getPreclaimDetailBreadcrumbs(
    context: 'admin' | 'user',
    preclaimName?: string | null,
    preclaimId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getPreclaimListBreadcrumbs(context);
    const preclaimLabel = preclaimName || "Preclaim Set";
    const preclaimPath = context === 'admin'
        ? `/admin/iot/preclaims/${preclaimId}`
        : `/user/iot/preclaims/${preclaimId}`;

    return [
        ...baseBreadcrumbs,
        [preclaimLabel, preclaimPath]
    ];
}

/**
 * Get breadcrumbs for preclaim edit page
 */
export function getPreclaimEditBreadcrumbs(
    context: 'admin' | 'user',
    preclaimName?: string | null,
    preclaimId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getPreclaimListBreadcrumbs(context);
    const preclaimLabel = preclaimName || "Preclaim Set";
    const preclaimPath = context === 'admin'
        ? `/admin/iot/preclaims/${preclaimId}`
        : `/user/iot/preclaims/${preclaimId}`;

    return [
        ...baseBreadcrumbs,
        [preclaimLabel, preclaimPath],
        ["Edit", ""]
    ];
}

/**
 * Get breadcrumbs for preclaim new/create page
 */
export function getPreclaimNewBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    const baseBreadcrumbs = getPreclaimListBreadcrumbs(context);

    return [
        ...baseBreadcrumbs,
        ["New Preclaim Set", ""]
    ];
}

/**
 * Get breadcrumbs for resource list page
 * Note: Resources are admin-only
 */
export function getResourceListBreadcrumbs(): BreadcrumbItem[] {
    return [
        ["Admin", "/admin"],
        ["IOT", ""],
        ["Resources", "/admin/iot/resources"]
    ];
}

/**
 * Get breadcrumbs for resource detail page
 * Note: Resources are admin-only
 */
export function getResourceDetailBreadcrumbs(
    resourceName?: string | null,
    resourceId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getResourceListBreadcrumbs();
    const resourceLabel = resourceName || "Resource";
    const resourcePath = `/admin/iot/resources/${resourceId}`;

    return [
        ...baseBreadcrumbs,
        [resourceLabel, resourcePath]
    ];
}

/**
 * Get breadcrumbs for resource edit page
 * Note: Resources are admin-only
 */
export function getResourceEditBreadcrumbs(
    resourceName?: string | null,
    resourceId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getResourceListBreadcrumbs();
    const resourceLabel = resourceName || "Resource";
    const resourcePath = `/admin/iot/resources/${resourceId}`;

    return [
        ...baseBreadcrumbs,
        [resourceLabel, resourcePath],
        ["Edit", ""]
    ];
}

/**
 * Get breadcrumbs for resource new/create page
 * Note: Resources are admin-only
 */
export function getResourceNewBreadcrumbs(): BreadcrumbItem[] {
    const baseBreadcrumbs = getResourceListBreadcrumbs();

    return [
        ...baseBreadcrumbs,
        ["New Resource", ""]
    ];
}

/**
 * Get breadcrumbs for pin rule list page
 */
export function getPinRuleListBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    if (context === 'admin') {
        return [
            ["Admin", "/admin"],
            ["IoT", ""],
            ["Pin Rules", "/admin/iot/pin-rules"]
        ];
    } else {
        return [
            ["User", "/user"],
            ["IOT", ""],
            ["Pin Rules", "/user/iot/pin-rules"]
        ];
    }
}

/**
 * Get breadcrumbs for pin rule detail page (read-only view)
 */
export function getPinRuleDetailBreadcrumbs(
    context: 'admin' | 'user',
    pinRuleName?: string | null,
    pinRuleId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getPinRuleListBreadcrumbs(context);
    const pinRuleLabel = pinRuleName || "Pin Rule";
    const pinRulePath = context === 'admin'
        ? `/admin/iot/pin-rules/${pinRuleId}`
        : `/user/iot/pin-rules/${pinRuleId}`;

    return [
        ...baseBreadcrumbs,
        [pinRuleLabel, pinRulePath]
    ];
}

/**
 * Get breadcrumbs for pin rule edit page (form)
 */
export function getPinRuleEditBreadcrumbs(
    context: 'admin' | 'user',
    pinRuleName?: string | null,
    pinRuleId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getPinRuleListBreadcrumbs(context);
    const pinRuleLabel = pinRuleName || "Pin Rule";
    const pinRulePath = context === 'admin'
        ? `/admin/iot/pin-rules/${pinRuleId}`
        : `/user/iot/pin-rules/${pinRuleId}`;

    return [
        ...baseBreadcrumbs,
        [pinRuleLabel, pinRulePath],
        ["Edit", ""]
    ];
}

/**
 * Get breadcrumbs for pin rule new/create page
 */
export function getPinRuleNewBreadcrumbs(context: 'admin' | 'user'): BreadcrumbItem[] {
    const baseBreadcrumbs = getPinRuleListBreadcrumbs(context);

    return [
        ...baseBreadcrumbs,
        ["New Pin Rule", ""]
    ];
}

/**
 * Get breadcrumbs for factory token list page
 * Note: Factory tokens are admin-only
 */
export function getFactoryTokenListBreadcrumbs(): BreadcrumbItem[] {
    return [
        ["Admin", "/admin"],
        ["IoT", ""],
        ["Factory Tokens", "/admin/iot/factory_tokens"]
    ];
}

/**
 * Get breadcrumbs for factory token detail page
 * Note: Factory tokens are admin-only
 */
export function getFactoryTokenDetailBreadcrumbs(
    tokenName?: string | null,
    tokenId?: string
): BreadcrumbItem[] {
    const baseBreadcrumbs = getFactoryTokenListBreadcrumbs();
    const tokenLabel = tokenName || "Factory Token";
    const tokenPath = `/admin/iot/factory_tokens/${tokenId}`;

    return [
        ...baseBreadcrumbs,
        [tokenLabel, tokenPath]
    ];
}

/**
 * Get breadcrumbs for factory token new/create page
 * Note: Factory tokens are admin-only
 */
export function getFactoryTokenNewBreadcrumbs(): BreadcrumbItem[] {
    const baseBreadcrumbs = getFactoryTokenListBreadcrumbs();

    return [
        ...baseBreadcrumbs,
        ["New Factory Token", ""]
    ];
}

