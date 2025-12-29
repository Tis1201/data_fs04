import type { PageServerLoad } from './$types';
import prisma from '$lib/server/prisma';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';

export const load = restrict(
    async ({ }: AuthenticatedEvent) => {
        const subscriptions = await prisma.subscription.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 100,
            include: {
                plan: {
                    select: { code: true, name: true }
                },
                account: {
                    select: { id: true, name: true, slug: true }
                }
            }
        });

        return {
            subscriptions: subscriptions.map(s => ({
                id: s.id,
                accountId: s.accountId,
                accountName: s.account.name,
                accountSlug: s.account.slug,
                planCode: s.plan.code,
                planName: s.plan.name,
                source: s.source,
                status: s.status,
                stripeCustomerId: s.stripeCustomerId,
                stripeSubscriptionId: s.stripeSubscriptionId,
                currentPeriodEnd: s.currentPeriodEnd,
                cancelAtPeriodEnd: s.cancelAtPeriodEnd,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt
            }))
        };
    },
    ['ADMIN']
) satisfies PageServerLoad;
