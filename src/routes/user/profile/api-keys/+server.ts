import { json } from '@sveltejs/kit';
import { Prisma } from '@prisma/client';
import { generateId } from 'lucia';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';
import type { RequestHandler } from './$types';
import { handleApiError } from '$lib/server/errors/errorHandlers';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deleteEntityExpirationCronjob } from '$lib/server/cron/helpers/entityCronjobManager';
import { logger } from '$lib/server/logger';

// List API keys
export const GET = restrict(
    async ({ locals, auth, cookies }: any) => {
        try {
            if (!auth?.user?.id) {
                throw new Error('User not authenticated');
            }

            const userId = auth.user.id;

            const currentAccountId =
                locals.currentAccount?.account?.id ?? cookies.get('current_account_id');

            const whereClause: any = { userId };
            if (currentAccountId) {
                whereClause.OR = [
                    { accountId: currentAccountId },
                    { accountId: null }
                ];
            }

            const apiKeys = await locals.prisma.apiKey.findMany({
                where: whereClause,
                select: {
                    id: true,
                    name: true,
                    description: true,
                    key: true,
                    createdAt: true,
                    lastUsedAt: true,
                    expiresAt: true,
                    active: true,
                    accountId: true
                },
                orderBy: { createdAt: 'desc' }
            });

            const maskedApiKeys = apiKeys.map((key: any) => ({
                ...key,
                key: key.key.length > 8
                    ? `${key.key.substring(0, 4)}${'•'.repeat(key.key.length - 8)}${key.key.substring(key.key.length - 4)}`
                    : key.key
            }));

            return json(createSuccessResponse(maskedApiKeys, {
                message: 'API keys retrieved successfully'
            }));
        } catch (error) {
            console.error('Error fetching API keys:', error);
            return json(createErrorResponse(error instanceof Error ? error : new Error('Failed to retrieve API keys'), {
                code: 'API_KEYS_FETCH_ERROR',
                details: error instanceof Error ? error.message : 'Unknown error occurred'
            }), { status: 500 });
        }
    },
    [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

// Create new API key
export const POST = restrict(
    async ({ request, locals, auth, cookies }: any) => {
        try {
            const contentType = request.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                return json(createErrorResponse(new Error('This endpoint expects JSON.'), {
                    code: 'INVALID_CONTENT_TYPE'
                }), { status: 415 });
            }
            const data = await request.json();

            if (!data.name) {
                return json(createErrorResponse(new Error('Name is required'), {
                    code: 'VALIDATION_ERROR'
                }), { status: 400 });
            }

            const userId = auth.user.id;
            const { name, description = '' } = data;
            const trimmedName = String(name).trim();
            if (!trimmedName) {
                return json(createErrorResponse(new Error('Name is required'), {
                    code: 'VALIDATION_ERROR'
                }), { status: 400 });
            }

            const currentAccountId =
                locals.currentAccount?.account?.id ?? cookies.get('current_account_id');

            const existingKeysCount = await locals.prisma.apiKey.count({
                where: { userId }
            });

            if (existingKeysCount >= 10) {
                return json(createErrorResponse(new Error('You have reached the maximum limit of 10 API keys'), {
                    code: 'API_KEY_LIMIT_REACHED'
                }), { status: 400 });
            }

            const dupWhere = currentAccountId
                ? {
                      accountId: currentAccountId,
                      name: { equals: trimmedName, mode: 'insensitive' as const }
                  }
                : {
                      userId,
                      accountId: null,
                      name: { equals: trimmedName, mode: 'insensitive' as const }
                  };

            const nameTaken = await locals.prisma.apiKey.findFirst({
                where: dupWhere,
                select: { id: true }
            });
            if (nameTaken) {
                return json(
                    createErrorResponse(
                        new Error('An API key with this name already exists for this account.'),
                        { code: 'DUPLICATE_API_KEY_NAME' }
                    ),
                    { status: 400 }
                );
            }

            const apiKey = generateId(32);

            const newKey = await locals.prisma.apiKey.create({
                data: {
                    name: trimmedName,
                    description,
                    key: apiKey,
                    userId,
                    accountId: currentAccountId || null,
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                },
                select: {
                    id: true,
                    name: true,
                    key: true,
                    createdAt: true,
                    expiresAt: true
                }
            });

            await logAudit({
                actionType: AuditActionType.INSERT,
                tableName: 'ApiKey',
                recordId: newKey.id,
                oldData: null,
                newData: newKey,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            });

            return json(createSuccessResponse(newKey, {
                message: 'API key created successfully'
            }));
        } catch (error: any) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                return json(
                    createErrorResponse(
                        new Error('An API key with this name already exists for this account.'),
                        { code: 'DUPLICATE_API_KEY_NAME' }
                    ),
                    { status: 400 }
                );
            }
            return handleApiError({
                error,
                prisma: locals.prisma,
                defaultMessage: 'Failed to process request',
                action: 'processing data',
                status: 500
            });
        }
    },
    [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);

// Delete API key
export const DELETE = restrict(
    async ({ request, locals, auth, cookies }: any) => {
        try {
            const contentType = request.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                return json(createErrorResponse(new Error('This endpoint expects JSON.'), {
                    code: 'INVALID_CONTENT_TYPE'
                }), { status: 415 });
            }
            const data = await request.json();

            if (!data.id) {
                throw new Error('API key ID is required');
            }

            const userId = auth.user.id;
            const { id } = data;

            const currentAccountId =
                locals.currentAccount?.account?.id ?? cookies.get('current_account_id');

            const apiKey = await locals.prisma.apiKey.findFirst({
                where: {
                    id,
                    userId,
                    OR: currentAccountId
                        ? [{ accountId: currentAccountId }, { accountId: null }]
                        : [{ accountId: null }]
                }
            });

            if (!apiKey) {
                const error = new Error('API key not found or does not belong to you');
                (error as any).status = 404;
                (error as any).code = 'NOT_FOUND';
                throw error;
            }

            try {
                await deleteEntityExpirationCronjob(locals.prisma, 'apiKey', id);
                logger.info(`Deleted expiration cronjob for API key: ${id}`);
            } catch (cronError) {
                logger.warn(`Failed to delete cronjob for API key ${id}:`, cronError);
            }

            await locals.prisma.apiKey.delete({
                where: { id }
            });

            await logAudit({
                actionType: AuditActionType.DELETE,
                tableName: 'ApiKey',
                recordId: apiKey.id,
                oldData: apiKey,
                newData: null,
                userId: locals.user.id,
                ipAddress: locals.ipAddress,
                prisma: locals.prisma
            });

            return json(createSuccessResponse(null, {
                message: 'API key deleted successfully'
            }));
        } catch (error: any) {
            return handleApiError({
                error,
                prisma: locals.prisma,
                defaultMessage: 'Failed to process request',
                action: 'processing data',
                status: 400
            });
        }
    },
    [SystemRole.USER, SystemRole.ADMIN, SystemRole.SUPER_ADMIN]
);
