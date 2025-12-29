import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { logger } from '$lib/server/logger';
import { restrictAccountRole, type AccountAuthenticatedEvent } from '$lib/server/security/guards';
import prisma from '$lib/server/prisma';
import { getEntitlementsWithUsage } from '$lib/server/entitlements';

/**
 * Load billing data for the current account
 */
export const load = restrictAccountRole(
    async ({ auth, accountMembership }: AccountAuthenticatedEvent) => {
        try {
            const { accountId } = accountMembership;

            // Get entitlements with usage data
            const entitlements = await getEntitlementsWithUsage(accountId);

            // Get available plans for upgrade
            const plans = await prisma.plan.findMany({
                where: { isActive: true },
                orderBy: { maxDevices: 'asc' }
            });

            // Get subscription details if exists
            const subscription = await prisma.subscription.findUnique({
                where: { accountId },
                include: { plan: true }
            });

            return {
                billing: {
                    planCode: entitlements.planCode,
                    planName: entitlements.planName,
                    status: entitlements.status,
                    maxDevices: entitlements.maxDevices,
                    maxUsers: entitlements.maxUsers,
                    maxLogLinesPerMonth: entitlements.maxLogLinesPerMonth,
                    currentDevices: entitlements.currentDevices,
                    currentUsers: entitlements.currentUsers,
                    currentLogLines: entitlements.currentLogLines,
                    dataRetentionDays: entitlements.dataRetentionDays,
                    features: entitlements.features
                },
                subscription: subscription ? {
                    id: subscription.id,
                    status: subscription.status,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
                    stripeCustomerId: subscription.stripeCustomerId,
                    stripeSubscriptionId: subscription.stripeSubscriptionId
                } : null,
                plans: plans.map(p => ({
                    code: p.code,
                    name: p.name,
                    maxDevices: p.maxDevices,
                    maxUsers: p.maxUsers,
                    maxLogLinesPerMonth: p.maxLogLinesPerMonth,
                    dataRetentionDays: p.dataRetentionDays,
                    features: p.features as string[],
                    stripePriceId: p.stripePriceId
                })),
                currentAccount: {
                    id: accountMembership.accountId,
                    role: accountMembership.role
                }
            };
        } catch (err) {
            logger.error('Error loading billing data:', err as Record<string, any>);
            throw error(500, 'Failed to load billing data');
        }
    },
    ['ADMIN', 'OWNER', 'MEMBER']
) satisfies PageServerLoad;
