/**
 * Entitlements Service
 * 
 * Provides entitlement checking with Redis caching.
 * Single source of truth for what an account can do based on their subscription.
 * 
 * Usage:
 *   const entitlements = await getEntitlements(accountId);
 *   if (!entitlements.canAddDevice()) throw error(403, 'Device limit reached');
 */

import { getAdminPrisma } from '$lib/server/prisma';
import redis from '$lib/server/redis';
import { logger } from '$lib/server/logger';

// Cache TTL in seconds (5 minutes)
const CACHE_TTL = 300;

/**
 * Resolved entitlements for an account
 */
export interface Entitlements {
    accountId: string;
    planCode: string;
    planName: string;
    status: string;

    // Limits
    maxDevices: number;
    maxUsers: number;
    maxLogLinesPerMonth: number;
    dataRetentionDays: number;

    // Current usage (fetched on demand)
    currentDevices?: number;
    currentUsers?: number;
    currentLogLines?: number;

    // Features
    features: string[];

    // Helpers
    canAddDevice: () => boolean;
    canAddUser: () => boolean;
    hasFeature: (feature: string) => boolean;
}

/**
 * Raw entitlement data (what we cache)
 */
interface EntitlementData {
    accountId: string;
    planCode: string;
    planName: string;
    status: string;
    maxDevices: number;
    maxUsers: number;
    maxLogLinesPerMonth: number;
    dataRetentionDays: number;
    features: string[];
    // Overrides from subscription
    overrideMaxDevices: number | null;
    overrideMaxUsers: number | null;
}

/**
 * Get entitlements for an account with caching
 */
export async function getEntitlements(accountId: string): Promise<Entitlements> {
    const cacheKey = `entitlements:${accountId}`;

    // Try cache first
    if (redis) {
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                const data: EntitlementData = JSON.parse(cached);
                return buildEntitlements(data);
            }
        } catch (e) {
            logger.warn(`Entitlements cache read failed: ${(e as Error).message}`);
        }
    }

    // Fetch from database
    const data = await fetchEntitlementData(accountId);

    // Cache result
    if (redis) {
        try {
            await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(data));
        } catch (e) {
            logger.warn(`Entitlements cache write failed: ${(e as Error).message}`);
        }
    }

    return buildEntitlements(data);
}

/**
 * Invalidate entitlements cache for an account
 * Call this when subscription changes
 */
export async function invalidateEntitlements(accountId: string): Promise<void> {
    if (redis) {
        const cacheKey = `entitlements:${accountId}`;
        await redis.del(cacheKey);
        logger.info(`Invalidated entitlements cache for ${accountId}`);
    }
}

/**
 * Fetch entitlement data from database
 */
async function fetchEntitlementData(accountId: string): Promise<EntitlementData> {
    const prisma = getAdminPrisma();

    const subscription = await prisma.subscription.findUnique({
        where: { accountId },
        include: { plan: true }
    });

    // Default to free plan if no subscription
    if (!subscription) {
        const freePlan = await prisma.plan.findUnique({ where: { code: 'free' } });
        return {
            accountId,
            planCode: 'free',
            planName: freePlan?.name ?? 'Free',
            status: 'active',
            maxDevices: freePlan?.maxDevices ?? 5,
            maxUsers: freePlan?.maxUsers ?? 1,
            maxLogLinesPerMonth: freePlan?.maxLogLinesPerMonth ?? 10000,
            dataRetentionDays: freePlan?.dataRetentionDays ?? 7,
            features: (freePlan?.features as string[]) ?? [],
            overrideMaxDevices: null,
            overrideMaxUsers: null
        };
    }

    return {
        accountId,
        planCode: subscription.plan.code,
        planName: subscription.plan.name,
        status: subscription.status,
        maxDevices: subscription.overrideMaxDevices ?? subscription.plan.maxDevices,
        maxUsers: subscription.overrideMaxUsers ?? subscription.plan.maxUsers,
        maxLogLinesPerMonth: subscription.plan.maxLogLinesPerMonth,
        dataRetentionDays: subscription.plan.dataRetentionDays,
        features: (subscription.plan.features as string[]) ?? [],
        overrideMaxDevices: subscription.overrideMaxDevices,
        overrideMaxUsers: subscription.overrideMaxUsers
    };
}

/**
 * Build entitlements object with helper methods
 */
function buildEntitlements(data: EntitlementData): Entitlements {
    const prisma = getAdminPrisma();

    // Lazy-loaded usage counts
    let _currentDevices: number | undefined;
    let _currentUsers: number | undefined;
    let _currentLogLines: number | undefined;

    return {
        accountId: data.accountId,
        planCode: data.planCode,
        planName: data.planName,
        status: data.status,
        maxDevices: data.maxDevices,
        maxUsers: data.maxUsers,
        maxLogLinesPerMonth: data.maxLogLinesPerMonth,
        dataRetentionDays: data.dataRetentionDays,
        features: data.features,

        get currentDevices() { return _currentDevices; },
        get currentUsers() { return _currentUsers; },
        get currentLogLines() { return _currentLogLines; },

        canAddDevice: function () {
            // Must fetch current count synchronously - caller should pre-load
            return (_currentDevices ?? 0) < this.maxDevices;
        },

        canAddUser: function () {
            return (_currentUsers ?? 0) < this.maxUsers;
        },

        hasFeature: function (feature: string) {
            return this.features.includes(feature);
        }
    };
}

/**
 * Get entitlements with current usage counts loaded
 * Use this when you need to check limits
 */
export async function getEntitlementsWithUsage(accountId: string): Promise<Entitlements & { currentDevices: number; currentUsers: number; currentLogLines: number }> {
    const prisma = getAdminPrisma();
    const entitlements = await getEntitlements(accountId);

    // Fetch current counts
    const [deviceCount, userCount] = await Promise.all([
        prisma.device.count({ where: { accountId } }),
        prisma.accountMembership.count({ where: { accountId } })
    ]);

    // TODO: Implement actual log counting when log storage is finalized
    const logCount = 0;

    return {
        ...entitlements,
        currentDevices: deviceCount,
        currentUsers: userCount,
        currentLogLines: logCount,
        canAddDevice: function () {
            return this.currentDevices < this.maxDevices;
        },
        canAddUser: function () {
            return this.currentUsers < this.maxUsers;
        }
    };
}

/**
 * Check if account can add a device (throws if not)
 */
export async function checkDeviceLimit(accountId: string): Promise<void> {
    const entitlements = await getEntitlementsWithUsage(accountId);

    if (!entitlements.canAddDevice()) {
        const message = `Device limit reached (${entitlements.currentDevices}/${entitlements.maxDevices}). Upgrade to add more devices.`;
        logger.warn(`Device limit check failed for ${accountId}: ${message}`);
        throw new LimitExceededError('device', entitlements.currentDevices, entitlements.maxDevices);
    }
}

/**
 * Check if account can add a user (throws if not)
 */
export async function checkUserLimit(accountId: string): Promise<void> {
    const entitlements = await getEntitlementsWithUsage(accountId);

    if (!entitlements.canAddUser()) {
        const message = `User limit reached (${entitlements.currentUsers}/${entitlements.maxUsers}). Upgrade to add more users.`;
        logger.warn(`User limit check failed for ${accountId}: ${message}`);
        throw new LimitExceededError('user', entitlements.currentUsers, entitlements.maxUsers);
    }
}

/**
 * Check if account has a specific feature (throws if not)
 */
export async function checkFeature(accountId: string, feature: string): Promise<void> {
    const entitlements = await getEntitlements(accountId);

    if (!entitlements.hasFeature(feature)) {
        logger.warn(`Feature check failed for ${accountId}: ${feature} not available on ${entitlements.planCode} plan`);
        throw new FeatureNotAvailableError(feature, entitlements.planCode);
    }
}

/**
 * Custom error for limit exceeded
 */
export class LimitExceededError extends Error {
    public readonly type = 'LIMIT_EXCEEDED';
    public readonly limitType: 'device' | 'user';
    public readonly current: number;
    public readonly max: number;

    constructor(limitType: 'device' | 'user', current: number, max: number) {
        super(`${limitType} limit exceeded (${current}/${max})`);
        this.limitType = limitType;
        this.current = current;
        this.max = max;
    }
}

/**
 * Custom error for feature not available
 */
export class FeatureNotAvailableError extends Error {
    public readonly type = 'FEATURE_NOT_AVAILABLE';
    public readonly feature: string;
    public readonly planCode: string;

    constructor(feature: string, planCode: string) {
        super(`Feature '${feature}' is not available on the ${planCode} plan`);
        this.feature = feature;
        this.planCode = planCode;
    }
}
