import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { restrict } from '$lib/server/security/guards';
import type { AuthenticatedLoadEvent, AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { createErrorResponse, createSuccessResponse } from '$lib/types/api';
import { handleZenstackError, handleFormError } from '$lib/server/errors/errorHandlers';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

const idSchema = z.object({
    id: z.string().min(1, 'Token log ID is required')
});

const clearSchema = z.object({
    olderThan: z
        .string()
        .min(1)
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().positive())
});

export const load = restrict(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        try {
            // Get query parameters for filtering, sorting, and pagination
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = url.searchParams.get('sort_order') || 'desc';
            const tokenTypes = url.searchParams.get('tokenTypes')?.split(',').filter(Boolean) || [];
            const actions = url.searchParams.get('actions')?.split(',').filter(Boolean) || [];
            const success = url.searchParams.get('success') || '';
            const accountId = url.searchParams.get('accountId') || '';
            const userId = url.searchParams.get('userId') || '';
            const startDate = url.searchParams.get('startDate') || '';
            const endDate = url.searchParams.get('endDate') || '';

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build the where clause for filtering
            const where: any = {};
            
            // Add search filter if provided
            if (search) {
                where.OR = [
                    { id: { contains: search } },
                    { tokenId: { contains: search } },
                    { ipAddress: { contains: search } },
                    { userAgent: { contains: search } },
                    { error: { contains: search } }
                ];
            }
            
            // Add token type filter if provided
            if (tokenTypes.length > 0) {
                where.tokenType = { in: tokenTypes };
            }
            
            // Add action filter if provided
            if (actions.length > 0) {
                where.action = { in: actions };
            }
            
            // Add success filter if provided
            const successFilters = success ? success.split(',') : [];
            if (successFilters.length > 0) {
                // If both true and false are selected, don't filter by success
                if (!(successFilters.includes('true') && successFilters.includes('false'))) {
                    where.success = successFilters.includes('true');
                }
            }
            
            // Add account filter if provided
            if (accountId) {
                where.accountId = accountId;
            }
            
            // Add user filter if provided
            if (userId) {
                where.userId = userId;
            }
            
            // Add date range filter if provided
            if (startDate || endDate) {
                where.createdAt = {};
                
                if (startDate) {
                    where.createdAt.gte = new Date(startDate);
                }
                
                if (endDate) {
                    // Set end date to end of day
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(23, 59, 59, 999);
                    where.createdAt.lte = endDateTime;
                }
            }

            // Query token logs with filtering, sorting, and pagination
            const [tokenLogs, totalLogs] = await Promise.all([
                locals.prisma.tokenUsageLog.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        tokenId: true,
                        tokenType: true,
                        action: true,
                        ipAddress: true,
                        userAgent: true,
                        success: true,
                        error: true,
                        createdAt: true,
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }),
                locals.prisma.tokenUsageLog.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalLogs / perPage);
            
            // Get accounts for filtering (limit to 20 most recent)
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                take: 20,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true }
            });
            
            // Get users for filtering (limit to 20 most recent)
            const users = await locals.prisma.user.findMany({
                take: 20,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, email: true }
            });
            
            // Calculate metrics for dashboard
            const now = new Date();
            const oneDayAgo = new Date(now);
            oneDayAgo.setDate(now.getDate() - 1);
            
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(now.getDate() - 7);
            
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setMonth(now.getMonth() - 1);
            
            // Get metrics
            const [
                totalCount,
                successCount,
                failureCount,
                last24HoursCount,
                lastWeekCount,
                lastMonthCount,
                tokenTypeDistribution,
                actionDistribution
            ] = await Promise.all([
                locals.prisma.tokenUsageLog.count(),
                locals.prisma.tokenUsageLog.count({ where: { success: true } }),
                locals.prisma.tokenUsageLog.count({ where: { success: false } }),
                locals.prisma.tokenUsageLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
                locals.prisma.tokenUsageLog.count({ where: { createdAt: { gte: oneWeekAgo } } }),
                locals.prisma.tokenUsageLog.count({ where: { createdAt: { gte: oneMonthAgo } } }),
                locals.prisma.tokenUsageLog.groupBy({
                    by: ['tokenType'],
                    _count: { id: true }
                }),
                locals.prisma.tokenUsageLog.groupBy({
                    by: ['action'],
                    _count: { id: true }
                })
            ]);
            
            // Format the distribution data
            const tokenTypeStats = tokenTypeDistribution.map((item) => ({
                type: item.tokenType,
                count: item._count.id
            }));
            
            const actionTypeStats = actionDistribution.map((item) => ({
                type: item.action,
                count: item._count.id
            }));

            // Return the data
            return {
                tokenLogs,
                accounts,
                users,
                meta: {
                    totalItems: totalLogs,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {
                    tokenTypes: tokenTypes,
                    actions: actions,
                    success: success,
                    accountId: accountId,
                    userId: userId,
                    startDate: startDate,
                    endDate: endDate
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                },
                metrics: {
                    total: totalCount,
                    success: successCount,
                    failure: failureCount,
                    last24Hours: last24HoursCount,
                    lastWeek: lastWeekCount,
                    lastMonth: lastMonthCount,
                    tokenTypeDistribution: tokenTypeStats,
                    actionDistribution: actionTypeStats
                },
                tokenTypeOptions: [
                    { id: 'access', name: 'Access Token' },
                    { id: 'refresh', name: 'Refresh Token' },
                    { id: 'api_key', name: 'API Key' }
                ],
                actionOptions: [
                    { id: 'issue', name: 'Issue' },
                    { id: 'refresh', name: 'Refresh' },
                    { id: 'revoke', name: 'Revoke' },
                    { id: 'use', name: 'Use' },
                    { id: 'rotate', name: 'Rotate' }
                ]
            };
        } catch (err) {
            logger.error(`Error loading token logs: ${err}`);
            const errorResponse = await handleZenstackError({
                error: err,
                defaultMessage: 'Failed to load token logs',
                prisma: locals.prisma,
                requestId: locals.requestId
            });
            throw error(500, errorResponse.error.message);
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
);

export const actions: Actions = {
    deleteLog: restrict(
        async ({ request, locals, auth }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const form = await superValidate(formData, zod(idSchema));
            const id = form.data.id;

            if (!auth) {
                throw error(401, 'Unauthorized');
            }

            if (!id) {
                return message(form, createErrorResponse('Token log ID is required'), { status: 400 });
            }

            try {
                const tokenUsageLog = await locals.prisma.tokenUsageLog.delete({
                    where: { id }
                });

                logger.info(`Token log deleted: ${id}`);
                const userId = locals.user?.id ?? auth.user.id;
                const ipAddress = (locals as any)?.ipAddress ?? 'unknown';

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'TokenUsageLog',
                    recordId: id,
                    oldData: tokenUsageLog,
                    newData: null,
                    userId,
                    ipAddress,
                    prisma: locals.prisma
                })

                return message(
                    form,
                    createSuccessResponse('Token log deleted successfully')
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to delete token log',
                    action: 'token log deletion'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    clearLogs: restrict(
        async ({ request, locals, auth }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const form = await superValidate(formData, zod(clearSchema));
            const days = form.data.olderThan;

            if (!auth) {
                throw error(401, 'Unauthorized');
            }

            try {
                const threshold = new Date();
                threshold.setDate(threshold.getDate() - days);

                const tokenUsageLogs = await locals.prisma.tokenUsageLog.findMany({
                    where: {
                        createdAt: {
                            lt: threshold
                        }
                    }
                });
                
                // Delete logs older than the threshold
                const result = await locals.prisma.tokenUsageLog.deleteMany({
                    where: {
                        createdAt: {
                            lt: threshold
                        }
                    }
                });

                logger.info(`Cleared ${result.count} token logs older than ${days} days`);
                
                await Promise.all(
                    tokenUsageLogs.map((log) =>
                        logAudit({
                            actionType: AuditActionType.DELETE,
                            tableName: 'TokenUsageLog',
                            recordId: log.id,
                            oldData: log,
                            newData: null,
                            userId: locals.user?.id ?? auth.user.id,
                            ipAddress: (locals as any)?.ipAddress ?? 'unknown',
                            prisma: locals.prisma
                        })
                    )
                );

                return message(
                    form,
                    createSuccessResponse(`Successfully cleared ${result.count} token logs older than ${days} days`)
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to clear token logs',
                    action: 'token log clearing'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
