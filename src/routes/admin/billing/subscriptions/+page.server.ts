import type { PageServerLoad } from './$types';
import prisma from '$lib/server/prisma';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';

export const load = restrict(
    async ({ url }: AuthenticatedEvent) => {
        const search = url.searchParams.get('search') || '';
        const statusFilter = url.searchParams.get('statuses');
        const sourceFilter = url.searchParams.get('sources');
        const sortField = url.searchParams.get('sort_field') || 'updatedAt';
        const sortOrder = url.searchParams.get('sort_order') || 'desc';

        // Build where clause
        const where: any = {};

        if (search) {
            where.OR = [
                { account: { name: { contains: search, mode: 'insensitive' } } },
                { account: { slug: { contains: search, mode: 'insensitive' } } },
                { plan: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }

        if (statusFilter) {
            const statuses = statusFilter.split(',').filter(Boolean);
            if (statuses.length > 0) {
                where.status = { in: statuses };
            }
        }

        if (sourceFilter) {
            const sources = sourceFilter.split(',').filter(Boolean);
            if (sources.length > 0) {
                where.source = { in: sources };
            }
        }

        // Map sort field to Prisma field
        const sortFieldMap: Record<string, any> = {
            'accountName': { account: { name: sortOrder as 'asc' | 'desc' } },
            'planName': { plan: { name: sortOrder as 'asc' | 'desc' } },
            'status': { status: sortOrder as 'asc' | 'desc' },
            'source': { source: sortOrder as 'asc' | 'desc' },
            'currentPeriodEnd': { currentPeriodEnd: sortOrder as 'asc' | 'desc' },
            'updatedAt': { updatedAt: sortOrder as 'asc' | 'desc' },
            'createdAt': { createdAt: sortOrder as 'asc' | 'desc' }
        };

        const orderBy = sortFieldMap[sortField] || { updatedAt: 'desc' };

        const subscriptions = await prisma.subscription.findMany({
            where,
            orderBy,
            take: 100,
            include: {
                plan: {
                    select: { id: true, code: true, name: true }
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
                planId: s.plan.id,
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
            })),
            meta: {
                page: 1,
                per_page: subscriptions.length,
                total_records: subscriptions.length,
                total_pages: 1,
                sort_field: sortField,
                sort_order: sortOrder
            }
        };
    },
    ['ADMIN']
) satisfies PageServerLoad;
