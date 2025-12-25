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
    id: z.string().min(1, 'Refresh token ID is required')
});

const userIdSchema = z.object({
    userId: z.string().min(1, 'User ID is required')
});

const accountIdSchema = z.object({
    accountId: z.string().min(1, 'Account ID is required')
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
            const isRevoked = url.searchParams.get('isRevoked') || '';
            const accountId = url.searchParams.get('accountId') || '';
            const userId = url.searchParams.get('userId') || '';

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build the where clause for filtering
            const where: any = {};
            
            // Add search filter if provided
            if (search) {
                where.OR = [
                    { id: { contains: search } },
                    { deviceId: { contains: search } },
                    { ipAddress: { contains: search } },
                    { userAgent: { contains: search } }
                ];
            }
            
            // Add revoked filter if provided
            const revokedFilters = isRevoked ? isRevoked.split(',') : [];
            if (revokedFilters.length > 0) {
                // If both true and false are selected, don't filter by isRevoked
                if (!(revokedFilters.includes('true') && revokedFilters.includes('false'))) {
                    where.isRevoked = revokedFilters.includes('true');
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

            // Query refresh tokens with filtering, sorting, and pagination
            const [refreshTokens, totalTokens] = await Promise.all([
                locals.prisma.refreshToken.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        deviceId: true,
                        userAgent: true,
                        ipAddress: true,
                        isRevoked: true,
                        revokedAt: true,
                        expiresAt: true,
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
                locals.prisma.refreshToken.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalTokens / perPage);
            
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

            // Return the data
            return {
                refreshTokens,
                accounts,
                users,
                meta: {
                    totalItems: totalTokens,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {
                    isRevoked: isRevoked,
                    accountId: accountId,
                    userId: userId
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error(`Error loading refresh tokens: ${err}`);
            const errorResponse = await handleZenstackError({
                error: err,
                defaultMessage: 'Failed to load refresh tokens',
                prisma: locals.prisma,
                requestId: locals.requestId
            });
            throw error(500, errorResponse.error.message);
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
);

export const actions: Actions = {
    revokeToken: restrict(
        async ({ request, locals, auth }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const form = await superValidate(formData, zod(idSchema));
            const id = form.data.id;

            if (!auth) {
                throw error(401, 'Unauthorized');
            }

            if (!id) {
                return message(form, createErrorResponse('Refresh token ID is required'), { status: 400 });
            }

            try {
                // Check if token is already revoked
                const token = await locals.prisma.refreshToken.findUnique({
                    where: { id },
                    select: { isRevoked: true, revokedAt: true }
                });

                if (token?.isRevoked) {
                    return message(
                        form,
                        createErrorResponse('Token is already revoked'),
                        { status: 400 }
                    );
                }

                // Revoke the token
                const revokedToken = await locals.prisma.refreshToken.update({
                    where: { id },
                    data: {
                        isRevoked: true,
                        revokedAt: new Date()
                    },
                    select: { isRevoked: true, revokedAt: true }
                });

                logger.info(`Refresh token revoked: ${id}`);
                const userId = locals.user?.id ?? auth.user.id;
                const ipAddress = (locals as any)?.ipAddress ?? 'unknown';

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'RefreshToken',
                    recordId: id,
                    oldData: token,
                    newData: revokedToken,
                    userId,
                    ipAddress,
                    prisma: locals.prisma
                })

                return message(
                    form,
                    createSuccessResponse('Refresh token revoked successfully')
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to revoke refresh token',
                    action: 'refresh token revocation'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    deleteToken: restrict(
        async ({ request, locals, auth }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const form = await superValidate(formData, zod(idSchema));
            const id = form.data.id;

            if (!auth) {
                throw error(401, 'Unauthorized');
            }

            if (!id) {
                return message(form, createErrorResponse('Refresh token ID is required'), { status: 400 });
            }

            try {
                // Delete the associated expiration cronjob first
                try {
                    await deleteEntityExpirationCronjob(locals.prisma, 'refreshToken', id);
                    logger.info(`Deleted expiration cronjob for refresh token: ${id}`);
                } catch (cronError) {
                    logger.warn(`Failed to delete cronjob for refresh token ${id}:`, cronError);
                }

                const token = await locals.prisma.refreshToken.delete({
                    where: { id }
                });

                logger.info(`Refresh token deleted: ${id}`);
                const userId = locals.user?.id ?? auth.user.id;
                const ipAddress = (locals as any)?.ipAddress ?? 'unknown';

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'RefreshToken',
                    recordId: id,
                    oldData: token,
                    newData: null,
                    userId,
                    ipAddress,
                    prisma: locals.prisma
                })

                return message(
                    form,
                    createSuccessResponse('Refresh token deleted successfully')
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to delete refresh token',
                    action: 'refresh token deletion'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    revokeAllForUser: restrict(
        async ({ request, locals, auth }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const form = await superValidate(formData, zod(userIdSchema));
            const userId = form.data.userId;

            if (!auth) {
                throw error(401, 'Unauthorized');
            }

            if (!userId) {
                return message(form, createErrorResponse('User ID is required'), { status: 400 });
            }

            try {
                const refreshTokens = await locals.prisma.refreshToken.findMany({
                    where: {
                        userId,
                        isRevoked: false
                    }
                });

                // Revoke all non-revoked tokens for the user
                const result = await locals.prisma.refreshToken.updateMany({
                    where: { 
                        userId,
                        isRevoked: false
                    },
                    data: {
                        isRevoked: true,
                        revokedAt: new Date()
                    }
                });

                logger.info(`Revoked ${result.count} refresh tokens for user: ${userId}`);
                const userIdForAudit = locals.user?.id ?? auth.user.id;
                const ipAddress = (locals as any)?.ipAddress ?? 'unknown';

                await Promise.all(
                    refreshTokens.map(token =>
                        logAudit({
                            actionType: AuditActionType.UPDATE,
                            tableName: 'RefreshToken',
                            recordId: token.id,
                            oldData: { isRevoked: false, revokedAt: null },
                            newData: { isRevoked: true, revokedAt: new Date() },
                            userId: userIdForAudit,
                            ipAddress,
                            prisma: locals.prisma
                        })
                    )
                );

                return message(
                    form,
                    createSuccessResponse(`Successfully revoked ${result.count} refresh tokens`)
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to revoke user refresh tokens',
                    action: 'user refresh token revocation'
                });
            }
        },
        [SystemRole.ADMIN]
    ),
    
    revokeAllForAccount: restrict(
        async ({ request, locals, auth }: AuthenticatedEvent) => {
            const formData = await request.formData();
            const form = await superValidate(formData, zod(accountIdSchema));
            const accountId = form.data.accountId;

            if (!auth) {
                throw error(401, 'Unauthorized');
            }

            if (!accountId) {
                return message(form, createErrorResponse('Account ID is required'), { status: 400 });
            }

            try {
                const refreshTokens = await locals.prisma.refreshToken.findMany({
                    where: {
                        accountId,
                        isRevoked: false
                    }
                });

                // Revoke all non-revoked tokens for the account
                const result = await locals.prisma.refreshToken.updateMany({
                    where: { 
                        accountId,
                        isRevoked: false
                    },
                    data: {
                        isRevoked: true,
                        revokedAt: new Date()
                    }
                });

                logger.info(`Revoked ${result.count} refresh tokens for account: ${accountId}`);
                const userIdForAudit = locals.user?.id ?? auth.user.id;
                const ipAddress = (locals as any)?.ipAddress ?? 'unknown';

                await Promise.all(
                    refreshTokens.map(token =>
                        logAudit({
                            actionType: AuditActionType.UPDATE,
                            tableName: 'RefreshToken',
                            recordId: token.id,
                            oldData: { isRevoked: false, revokedAt: null },
                            newData: { isRevoked: true, revokedAt: new Date() },
                            userId: userIdForAudit,
                            ipAddress,
                            prisma: locals.prisma
                        })
                    )
                );

                return message(
                    form,
                    createSuccessResponse(`Successfully revoked ${result.count} refresh tokens`)
                );
            } catch (err) {
                return handleFormError({
                    error: err,
                    form,
                    prisma: locals.prisma,
                    requestId: locals.requestId,
                    defaultMessage: 'Failed to revoke account refresh tokens',
                    action: 'account refresh token revocation'
                });
            }
        },
        [SystemRole.ADMIN]
    )
};
