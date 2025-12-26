import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { restrict, type AuthenticatedLoadEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

export const load = restrict(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        // Get filter parameters from URL
        const accountId = url.searchParams.get('accountId');
        const userId = url.searchParams.get('userId');
        const actionType = url.searchParams.get('actionType');
        const tableName = url.searchParams.get('tableName');
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const search = url.searchParams.get('search');
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

        // Build query
        const where: any = {};
        
        if (accountId) {
            // Get all user IDs for this account
            const accountMemberships = await locals.prisma.accountMembership.findMany({
                where: { accountId },
                select: { userId: true }
            });
            const userIds = accountMemberships.map(am => am.userId);
            where.userId = { in: userIds };
        }
        
        if (userId) {
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

        // Fetch accounts for filter dropdown
        const accounts = await locals.prisma.account.findMany({
            select: {
                id: true,
                name: true,
                slug: true
            },
            orderBy: { name: 'asc' }
        });

        // Fetch users for filter dropdown (filtered by account if selected)
        const userWhere: any = {};
        if (accountId) {
            const accountMemberships = await locals.prisma.accountMembership.findMany({
                where: { accountId },
                select: { userId: true }
            });
            userWhere.id = { in: accountMemberships.map(am => am.userId) };
        }
        
        const users = await locals.prisma.user.findMany({
            where: userWhere,
            select: {
                id: true,
                name: true,
                email: true
            },
            orderBy: { name: 'asc' }
        });

        // Get unique table names for filter
        const tableNames = await locals.prisma.auditLog.findMany({
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
            accounts,
            users,
            tableNames: tableNames.map(t => t.tableName),
            filters: {
                accountId,
                userId,
                actionType,
                tableName,
                startDate,
                endDate,
                search
            }
        };
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

