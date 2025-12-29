import type { PageServerLoad } from './$types';
import prisma from '$lib/server/prisma';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';

export const load = restrict(
    async ({ }: AuthenticatedEvent) => {
        const plans = await prisma.plan.findMany({
            orderBy: { maxDevices: 'asc' },
            include: {
                _count: {
                    select: { subscriptions: true }
                }
            }
        });

        return {
            plans: plans.map(p => ({
                id: p.id,
                code: p.code,
                name: p.name,
                isActive: p.isActive,
                maxDevices: p.maxDevices,
                maxUsers: p.maxUsers,
                maxLogLinesPerMonth: p.maxLogLinesPerMonth,
                dataRetentionDays: p.dataRetentionDays,
                stripeProductId: p.stripeProductId,
                stripePriceId: p.stripePriceId,
                features: p.features as string[],
                subscriptionCount: p._count.subscriptions
            }))
        };
    },
    ['ADMIN']
) satisfies PageServerLoad;
