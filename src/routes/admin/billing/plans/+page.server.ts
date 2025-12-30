import type { PageServerLoad } from './$types';
import prisma from '$lib/server/prisma';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';

export const load = restrict(
    async ({ url }: AuthenticatedEvent) => {
        const search = url.searchParams.get('search') || '';
        const statusFilter = url.searchParams.get('statuses');
        const sortField = url.searchParams.get('sort_field') || 'name';
        const sortOrder = url.searchParams.get('sort_order') || 'asc';

        // Build where clause
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (statusFilter) {
            // Handle comma-separated values for multi-select
            const statuses = statusFilter.split(',').filter(Boolean);
            if (statuses.length === 1) {
                where.isActive = statuses[0] === 'true';
            }
            // If both or none selected, don't filter
        }

        // Map sort field to Prisma field
        const sortFieldMap: Record<string, string> = {
            'name': 'name',
            'code': 'code',
            'isActive': 'isActive',
            'maxDevices': 'maxDevices',
            'maxUsers': 'maxUsers',
            'dataRetentionDays': 'dataRetentionDays',
            'maxLogLinesPerMonth': 'maxLogLinesPerMonth',
            'subscriptionCount': 'name' // Can't sort by count, fallback to name
        };

        const prismaField = sortFieldMap[sortField] || 'name';

        const plans = await prisma.plan.findMany({
            where,
            orderBy: { [prismaField]: sortOrder as 'asc' | 'desc' },
            include: {
                _count: {
                    select: { subscriptions: true }
                }
            }
        });

        // If sorting by subscription count, sort in JS
        let sortedPlans = plans;
        if (sortField === 'subscriptionCount') {
            sortedPlans = [...plans].sort((a, b) => {
                const diff = a._count.subscriptions - b._count.subscriptions;
                return sortOrder === 'asc' ? diff : -diff;
            });
        }

        return {
            plans: sortedPlans.map(p => ({
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
            })),
            meta: {
                page: 1,
                per_page: sortedPlans.length,
                total_records: sortedPlans.length,
                total_pages: 1,
                sort_field: sortField,
                sort_order: sortOrder
            }
        };
    },
    ['ADMIN']
) satisfies PageServerLoad;
