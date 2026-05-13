import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

export const load = restrict(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        // Get current user's account
        const accountMembership = await locals.prisma.accountMembership.findFirst({
            where: { userId: (locals as any).user?.id || (locals as any).auth?.user?.id },
            include: { account: true }
        });

        if (!accountMembership) {
            throw error(403, 'No account membership found');
        }

        const currentAccountId = accountMembership.accountId;

        // Get filter parameters from URL
        const userId = url.searchParams.get('userId');
        const actionType = url.searchParams.get('actionType');
        const tableName = url.searchParams.get('tableName');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const search = url.searchParams.get('search');
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

        // Get all user IDs for current account
        const accountMemberships = await locals.prisma.accountMembership.findMany({
            where: { accountId: currentAccountId },
            select: { userId: true }
        });
        const accountUserIds = accountMemberships.map(am => am.userId);

        // Build query - restricted to current account users
        const where: any = {
            userId: { in: accountUserIds }
        };
        
        if (userId && accountUserIds.includes(userId)) {
            where.userId = userId;
        }
        
        // Handle actionType filter (can be comma-separated)
        if (actionType) {
            const actionTypes = actionType.split(',').filter(Boolean);
            if (actionTypes.length === 1) {
                where.actionType = actionTypes[0];
            } else if (actionTypes.length > 1) {
                where.actionType = { in: actionTypes };
            }
        }
        
        // Handle tableName filter (can be comma-separated)
        if (tableName) {
            const tableNames = tableName.split(',').filter(Boolean);
            if (tableNames.length === 1) {
                where.tableName = tableNames[0];
            } else if (tableNames.length > 1) {
                where.tableName = { in: tableNames };
            }
        }
        
        if (startDate || endDate) {
            where.timestamp = {};
            if (startDate) where.timestamp.gte = new Date(startDate);
            if (endDate) where.timestamp.lte = new Date(endDate);
        }
        
        // Handle search filter
        if (search) {
            where.OR = [
                { changeSummary: { contains: search, mode: 'insensitive' } },
                { recordId: { contains: search, mode: 'insensitive' } },
                { tableName: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Fetch audit logs with pagination
        const [auditLogs, total] = await Promise.all([
            locals.prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: { timestamp: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            locals.prisma.auditLog.count({ where })
        ]);

        // Fetch users for filter dropdown (only from current account)
        const users = await locals.prisma.user.findMany({
            where: {
                id: { in: accountUserIds }
            },
            select: {
                id: true,
                name: true,
                email: true
            },
            orderBy: { name: 'asc' }
        });

        // Get unique table names for filter (only from current account's audit logs)
        const tableNames = await locals.prisma.auditLog.findMany({
            where: {
                userId: { in: accountUserIds }
            },
            select: {
                tableName: true
            },
            distinct: ['tableName'],
            orderBy: {
                tableName: 'asc'
            }
        });

        return {
            auditLogs,
            total,
            page,
            pageSize,
            currentAccount: accountMembership.account,
            users,
            tableNames: tableNames.map(t => t.tableName),
            filters: {
                userId,
                actionType,
                tableName,
                startDate,
                endDate,
                search
            }
        };
    },
    [SystemRole.USER] // Only allow user role to access this route
) satisfies PageServerLoad;

