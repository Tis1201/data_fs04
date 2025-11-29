import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url, locals }) => {
    try {
        // Check authentication
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            throw redirect(302, '/auth/login');
        }

        // Get query parameters
        const search = url.searchParams.get('search') || '';
        const statusesParam = url.searchParams.get('statuses') || '';
        const statuses = statusesParam ? statusesParam.split(',').filter(Boolean) : [];
        const page = parseInt(url.searchParams.get('page') || '1');
        const per_page = parseInt(url.searchParams.get('per_page') || '10');
        const requestedSortField = url.searchParams.get('sort') || url.searchParams.get('sort_field') || 'createdAt';
        const requestedSortOrder = url.searchParams.get('order') || url.searchParams.get('sort_order') || 'desc';
        const allowedSortFields = new Set(['name', 'createdAt', 'isActive']);
        const sort_field = allowedSortFields.has(requestedSortField ?? '') ? requestedSortField! : 'createdAt';
        const sort_order = requestedSortOrder === 'asc' ? 'asc' : 'desc';
        const orderBy = (() => {
            switch (sort_field) {
                case 'name':
                    return { name: sort_order };
                case 'isActive':
                    return { isActive: sort_order };
                default:
                    return { createdAt: sort_order };
            }
        })();

        // Build where clause - use direct account membership check
        const userAccountMemberships = await locals.prisma.accountMembership.findMany({
            where: { userId: auth.user.id },
            select: { accountId: true }
        });
        
        const accountIds = userAccountMemberships.map(m => m.accountId);
        
        // Simple where clause - filter by user's accounts and only show GLOBAL profiles
        const where: any = {
            accountId: { in: accountIds },
            level: 'GLOBAL' // Only show global profiles, not device-level copies
        };

        // Search filter
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Status filter
        if (statuses.length > 0) {
            const statusConditions = [];
            if (statuses.includes('active')) {
                statusConditions.push({ isActive: true });
            }
            if (statuses.includes('inactive')) {
                statusConditions.push({ isActive: false });
            }
            if (statusConditions.length > 0) {
                where.OR = where.OR ? [...where.OR, ...statusConditions] : statusConditions;
            }
        }

        // Get device profiles from database
        const profiles = await locals.prisma.deviceProfile.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                createdBy: true,
                updatedBy: true,
                account: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        assignments: true
                    }
                }
            },
            orderBy,
            take: per_page,
            skip: (page - 1) * per_page
        });

        const total = await locals.prisma.deviceProfile.count({ where });

        return {
            profiles,
            meta: {
                total,
                page,
                per_page,
                total_pages: Math.ceil(total / per_page),
                sort_field,
                sort_order,
                sort: {
                    field: sort_field,
                    order: sort_order
                }
            }
        };

    } catch (err) {
        console.error('Error loading device profiles:', err);
        if (err instanceof Error && 'status' in err) {
            throw err;
        }
        throw error(500, 'Failed to load device profiles');
    }
};
