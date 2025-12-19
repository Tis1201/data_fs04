/**
 * Feature Flag System
 * 
 * This module provides a flexible feature flag system that allows:
 * - Role-based feature access (admin, user)
 * - Account-specific feature overrides
 * - User-specific feature overrides
 * - Environment-based feature flags
 * - Easy feature rollout and A/B testing
 * 
 * @see docs/local/ROUTES_API_MAPPING.md - Section 7: Implement Feature Flag System
 */

// SystemRole is a string type in Prisma schema
export type SystemRole = 'ADMIN' | 'USER' | 'GUEST';

/**
 * Feature configuration
 */
export interface FeatureConfig {
	/** Feature enabled for admin role */
	admin?: boolean;
	/** Feature enabled for user role */
	user?: boolean;
	/** Feature enabled for guest role */
	guest?: boolean;
	/** Account IDs that have this feature enabled (overrides role) */
	accounts?: string[];
	/** User IDs that have this feature enabled (overrides role and account) */
	users?: string[];
	/** Environment variable to check (e.g., 'ENABLE_FEATURE_X') */
	envVar?: string;
	/** Default value if not specified */
	default?: boolean;
	/** Description of the feature */
	description?: string;
	/** Status: 'stable', 'beta', 'alpha', 'deprecated' */
	status?: 'stable' | 'beta' | 'alpha' | 'deprecated';
}

/**
 * User context for feature checking
 */
export interface FeatureUser {
	id: string;
	role: SystemRole;
	accountId?: string;
}

/**
 * All feature flags in the system
 */
export const features: Record<string, FeatureConfig> = {
	// ========================================
	// Bundle Features
	// ========================================
	'bundle.autoStartWaves': {
		admin: true,
		user: false,
		description: 'Automatically start next deployment wave when previous completes',
		status: 'stable'
	},

	'bundle.stopAllWaves': {
		admin: true,
		user: false,
		description: 'Stop all deployment waves across all devices',
		status: 'stable'
	},

	'bundle.timeoutChecking': {
		admin: true,
		user: false,
		description: 'Enable timeout checking for bundle deployments',
		status: 'stable'
	},

	'bundle.realTimeDeviceStatus': {
		admin: true,
		user: false,
		description: 'Check device online status in real-time during deployments',
		status: 'stable'
	},

	// ========================================
	// Device Features
	// ========================================
	'device.simulator': {
		admin: true,
		user: false,
		description: 'Access device simulator for testing',
		status: 'stable'
	},

	'device.verboseLogging': {
		admin: true,
		user: false,
		description: 'Enable verbose logging for device operations',
		status: 'stable'
	},

	'device.advancedDebug': {
		admin: true,
		user: false,
		description: 'Access advanced debugging features',
		status: 'stable'
	},

	'device.bulkOperations': {
		admin: true,
		user: true,
		description: 'Perform bulk operations on multiple devices',
		status: 'beta'
	},

	'device.remoteTerminal': {
		admin: true,
		user: true,
		description: 'Access remote terminal on devices',
		status: 'stable'
	},

	'device.remoteDesktop': {
		admin: true,
		user: true,
		description: 'Access remote desktop (RDP) on devices',
		status: 'stable'
	},

	// ========================================
	// Resource Features
	// ========================================
	'resource.changeOwnership': {
		admin: true,
		user: false,
		description: 'Change resource account ownership',
		status: 'stable'
	},

	'resource.cloudUpload': {
		admin: true,
		user: true,
		description: 'Upload resources to cloud storage',
		status: 'stable',
		envVar: 'ENABLE_CLOUD_STORAGE'
	},

	'resource.parseApk': {
		admin: true,
		user: true,
		description: 'Parse APK files for metadata',
		status: 'stable'
	},

	// ========================================
	// UI Features
	// ========================================
	'ui.includeAccountInfo': {
		admin: true,
		user: false,
		description: 'Show account information in device/bundle listings',
		status: 'stable'
	},

	'ui.advancedFilters': {
		admin: true,
		user: false,
		description: 'Show advanced filtering options',
		status: 'beta'
	},

	'ui.exportData': {
		admin: true,
		user: true,
		description: 'Export data to CSV/JSON',
		status: 'beta'
	},

	// ========================================
	// Integration Features
	// ========================================
	'integration.whatsapp': {
		admin: true,
		user: true,
		description: 'WhatsApp integration',
		status: 'stable',
		envVar: 'ENABLE_WHATSAPP'
	},

	'integration.webhooks': {
		admin: true,
		user: true,
		description: 'Webhook integrations',
		status: 'stable'
	},

	'integration.apiKeys': {
		admin: true,
		user: false,
		description: 'API key management',
		status: 'stable'
	},

	// ========================================
	// System Features
	// ========================================
	'system.monitoring': {
		admin: true,
		user: false,
		description: 'Access system monitoring and metrics',
		status: 'stable'
	},

	'system.debugPanel': {
		admin: true,
		user: false,
		description: 'Access debug panel with system information',
		status: 'stable'
	},

	'system.connectionDebug': {
		admin: true,
		user: false,
		description: 'Debug MQTT/WebSocket connections',
		status: 'stable'
	},

	// ========================================
	// Experimental Features
	// ========================================
	'experimental.newDashboard': {
		admin: false,
		user: false,
		description: 'New dashboard UI (experimental)',
		status: 'alpha',
		envVar: 'ENABLE_NEW_DASHBOARD'
	},

	'experimental.aiAssistant': {
		admin: false,
		user: false,
		description: 'AI-powered assistant (experimental)',
		status: 'alpha',
		envVar: 'ENABLE_AI_ASSISTANT'
	}
};

/**
 * Checks if a feature is enabled for a user
 * 
 * Priority order:
 * 1. User-specific override
 * 2. Account-specific override
 * 3. Environment variable
 * 4. Role-based access
 * 5. Default value
 * 
 * @param user - User context
 * @param featureName - Feature name (e.g., 'bundle.autoStartWaves')
 * @returns True if feature is enabled
 * 
 * @example
 * ```typescript
 * const canAutoStart = hasFeature(user, 'bundle.autoStartWaves');
 * if (canAutoStart) {
 *   await startNextWave(bundleId);
 * }
 * ```
 */
export function hasFeature(user: FeatureUser, featureName: string): boolean {
	const config = features[featureName];
	
	if (!config) {
		console.warn(`Unknown feature: ${featureName}`);
		return false;
	}

	// 1. Check user-specific override
	if (config.users?.includes(user.id)) {
		return true;
	}

	// 2. Check account-specific override
	if (user.accountId && config.accounts?.includes(user.accountId)) {
		return true;
	}

	// 3. Check environment variable
	if (config.envVar) {
		const envValue = process.env[config.envVar];
		if (envValue !== undefined) {
			return envValue.toLowerCase() === 'true' || envValue === '1';
		}
	}

	// 4. Check role-based access
	const roleAccess = config[user.role as keyof FeatureConfig];
	if (typeof roleAccess === 'boolean') {
		return roleAccess;
	}

	// 5. Return default value
	return config.default || false;
}

/**
 * Checks if user has ANY of the specified features
 * 
 * @param user - User context
 * @param featureNames - Array of feature names
 * @returns True if user has at least one feature
 */
export function hasAnyFeature(user: FeatureUser, featureNames: string[]): boolean {
	return featureNames.some(feature => hasFeature(user, feature));
}

/**
 * Checks if user has ALL of the specified features
 * 
 * @param user - User context
 * @param featureNames - Array of feature names
 * @returns True if user has all features
 */
export function hasAllFeatures(user: FeatureUser, featureNames: string[]): boolean {
	return featureNames.every(feature => hasFeature(user, feature));
}

/**
 * Gets all enabled features for a user
 * 
 * @param user - User context
 * @returns Array of enabled feature names
 * 
 * @example
 * ```typescript
 * const enabledFeatures = getUserFeatures(user);
 * // ['device.remoteTerminal', 'device.remoteDesktop', ...]
 * ```
 */
export function getUserFeatures(user: FeatureUser): string[] {
	const enabledFeatures: string[] = [];
	
	for (const [featureName] of Object.entries(features)) {
		if (hasFeature(user, featureName)) {
			enabledFeatures.push(featureName);
		}
	}
	
	return enabledFeatures;
}

/**
 * Gets feature configuration
 * 
 * @param featureName - Feature name
 * @returns Feature configuration or undefined
 */
export function getFeatureConfig(featureName: string): FeatureConfig | undefined {
	return features[featureName];
}

/**
 * Gets all features with their configurations
 * 
 * @param status - Optional filter by status
 * @returns Map of feature names to configurations
 */
export function getAllFeatures(status?: FeatureConfig['status']): Record<string, FeatureConfig> {
	if (!status) {
		return { ...features };
	}
	
	const filtered: Record<string, FeatureConfig> = {};
	for (const [name, config] of Object.entries(features)) {
		if (config.status === status) {
			filtered[name] = config;
		}
	}
	
	return filtered;
}

/**
 * Utility: Get loader options with feature flags applied
 * 
 * @param user - User context
 * @returns Loader options with feature flags
 * 
 * @example
 * ```typescript
 * const options = getLoaderOptionsWithFeatures(user);
 * const bundle = await loadBundleDetail(id, options);
 * ```
 */
export function getLoaderOptionsWithFeatures(user: FeatureUser) {
	return {
		// Permission options
		checkOwnership: user.role !== 'ADMIN',
		accountId: user.accountId,
		userId: user.id,
		role: user.role,
		
		// Feature flags
		verboseLogging: hasFeature(user, 'device.verboseLogging'),
		includeAccount: hasFeature(user, 'ui.includeAccountInfo'),
		
		// Bundle-specific features
		checkDeviceOnline: hasFeature(user, 'bundle.realTimeDeviceStatus'),
		enableAutoStartWaves: hasFeature(user, 'bundle.autoStartWaves'),
		enableTimeoutChecking: hasFeature(user, 'bundle.timeoutChecking'),
		enableAdvancedFeatures: hasFeature(user, 'bundle.stopAllWaves')
	};
}

/**
 * Creates a feature user context from locals
 * 
 * @param locals - SvelteKit locals
 * @returns Feature user context or null
 */
export async function createFeatureUser(locals: App.Locals): Promise<FeatureUser | null> {
	const session = await locals.auth.validate().catch(() => null);
	
	if (!session?.user) {
		return null;
	}
	
	return {
		id: session.user.id,
		role: session.user.systemRole as SystemRole,
		accountId: locals.currentAccount?.account?.id
	};
}

/**
 * Feature flag middleware for routes
 * Throws error if feature is not enabled
 * 
 * @param user - User context
 * @param featureName - Required feature
 * @throws Error with 403 status if feature not enabled
 * 
 * @example
 * ```typescript
 * export const GET: RequestHandler = async ({ locals }) => {
 *   const user = await createFeatureUser(locals);
 *   requireFeature(user, 'device.simulator');
 *   
 *   // Continue with simulator logic...
 * };
 * ```
 */
export function requireFeature(user: FeatureUser | null, featureName: string): void {
	if (!user) {
		const error = new Error('Authentication required');
		(error as any).status = 401;
		throw error;
	}

	if (!hasFeature(user, featureName)) {
		const error = new Error(`Feature not available: ${featureName}`);
		(error as any).status = 403;
		(error as any).code = 'FEATURE_NOT_AVAILABLE';
		throw error;
	}
}

/**
 * Gets features by category
 */
export function getFeaturesByCategory(category: string): Record<string, FeatureConfig> {
	const filtered: Record<string, FeatureConfig> = {};
	const prefix = `${category}.`;
	
	for (const [name, config] of Object.entries(features)) {
		if (name.startsWith(prefix)) {
			filtered[name] = config;
		}
	}
	
	return filtered;
}

/**
 * Feature categories
 */
export const FEATURE_CATEGORIES = [
	'bundle',
	'device',
	'resource',
	'ui',
	'integration',
	'system',
	'experimental'
] as const;

export type FeatureCategory = typeof FEATURE_CATEGORIES[number];

