import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma';
import { generateId } from 'lucia';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { logger } from '$lib/server/logger';

/**
 * API Key row shape for list display
 */
interface ApiKeyRow {
    id: string;
    name: string;
    key: string;
    fullKey: string; // Full key for copy functionality
    permission: string;
    createdOn: string;
    lastUsedOn: string | null;
    active: boolean;
}

// Helper to get current account ID from cookies or locals
function getCurrentAccountId(cookies: { get: (name: string) => string | undefined }, locals: App.Locals): string | undefined {
    return cookies.get('current_account_id') || (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
}

// Helper to mask API key (show first 3 and last 3 chars)
function maskApiKey(key: string): string {
    if (key.length <= 8) return key;
    return `${key.slice(0, 3)}••••${key.slice(-3)}`;
}

export const load = restrict(
    async ({ url, depends, locals, cookies }: AuthenticatedLoadEvent) => {
        depends('app:userApiKeys');

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const perPage = Math.min(100, Math.max(10, parseInt(url.searchParams.get('per_page') || '10', 10)));
        const search = (url.searchParams.get('search') || '').trim();
        const explicitUnsort = url.searchParams.has('sort_default');
        const sortField = explicitUnsort ? null : (url.searchParams.get('sort') || 'createdAt');
        const sortOrder = explicitUnsort
            ? null
            : ((url.searchParams.get('order') || 'desc') as 'asc' | 'desc');

        const accountId = getCurrentAccountId(cookies, locals);
        const userId = locals.user?.id;

        const toClientField = (f: string | null) =>
            f === null ? null : f === 'createdAt' ? 'createdOn' : f === 'lastUsedAt' ? 'lastUsedOn' : f;

        if (!accountId || !userId) {
            return {
                apiKeys: [],
                meta: {
                    pagination: { page: 1, per_page: perPage, total_records: 0, total_pages: 1 },
                    sort: { field: toClientField(sortField), order: sortOrder },
                    filters: { search }
                }
            };
        }

        // Build where clause
        const where: {
            accountId: string;
            OR?: Array<{ name?: { contains: string; mode: 'insensitive' } }>;
        } = {
            accountId
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Map sort field to database column (use createdAt when unsorted to keep stable order)
        const effectiveSortField = sortField ?? 'createdAt';
        const dbSortField =
            effectiveSortField === 'createdOn' ? 'createdAt' : effectiveSortField === 'lastUsedOn' ? 'lastUsedAt' : effectiveSortField;
        const validSortFields = ['name', 'createdAt', 'lastUsedAt'];
        const orderByField = validSortFields.includes(dbSortField) ? dbSortField : 'createdAt';
        const effectiveSortOrder = sortOrder ?? 'desc';

        // Count total records
        const totalRecords = await prisma.apiKey.count({ where });
        const totalPages = Math.max(1, Math.ceil(totalRecords / perPage));

        // Fetch API keys
        const dbApiKeys = await prisma.apiKey.findMany({
            where,
            orderBy: { [orderByField]: effectiveSortOrder },
            skip: (page - 1) * perPage,
            take: perPage,
            select: {
                id: true,
                name: true,
                key: true,
                description: true,
                active: true,
                createdAt: true,
                lastUsedAt: true
            }
        });

        // Map to ApiKeyRow
        const apiKeys: ApiKeyRow[] = dbApiKeys.map(k => ({
            id: k.id,
            name: k.name ?? 'Unnamed Key',
            key: maskApiKey(k.key),
            fullKey: k.key, // Full key for copy functionality
            permission: k.description ?? 'Read', // Use description as permission for now
            createdOn: k.createdAt.toISOString(),
            lastUsedOn: k.lastUsedAt?.toISOString() ?? null,
            active: k.active
        }));

        const clientSortField = toClientField(sortField);

        return {
            apiKeys,
            meta: {
                pagination: { page, per_page: perPage, total_records: totalRecords, total_pages: totalPages },
                sort: { field: clientSortField, order: sortOrder },
                filters: { search }
            }
        };
    },
    [SystemRole.USER]
) satisfies PageServerLoad;

export const actions: Actions = {
    /**
     * Create a new API Key
     */
    create: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const name = form.get('name') as string | null;
            const permission = form.get('permission') as string | null;

            if (!name?.trim()) return fail(400, { error: 'Key name is required' });
            if (!permission) return fail(400, { error: 'Permission is required' });

            const accountId = getCurrentAccountId(cookies, locals);
            const userId = locals.user?.id;

            if (!accountId || !userId) return fail(401, { error: 'Unauthorized' });

            try {
                // Check if user already has 10 or more API keys
                const existingKeysCount = await prisma.apiKey.count({
                    where: { accountId }
                });

                if (existingKeysCount >= 10) {
                    return fail(400, {
                        error: 'You have reached the maximum limit of 10 API keys. Please delete some keys before creating new ones.'
                    });
                }

                // Generate a new API key
                const newKey = generateId(32);
                const apiKey = await prisma.apiKey.create({
                    data: {
                        name: name.trim(),
                        description: permission, // Store permission in description field
                        key: newKey,
                        active: true,
                        userId,
                        accountId
                    }
                });

                logger.info('API key created successfully:', { apiKeyId: apiKey.id });

                await logAudit({
                    actionType: AuditActionType.INSERT,
                    tableName: 'ApiKey',
                    recordId: apiKey.id,
                    oldData: null,
                    newData: { id: apiKey.id, name: apiKey.name, permission },
                    userId,
                    ipAddress: '',
                    prisma
                });

                return {
                    success: true,
                    apiKey: newKey // Return full key only once at creation
                };
            } catch (err) {
                logger.error('Error creating API key:', { error: err });
                return fail(500, { error: 'Failed to create API key' });
            }
        },
        [SystemRole.USER]
    ),

    /**
     * Regenerate an existing API Key
     */
    regenerate: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;

            if (!id) return fail(400, { error: 'API key ID is required' });

            const accountId = getCurrentAccountId(cookies, locals);
            const userId = locals.user?.id;

            if (!accountId || !userId) return fail(401, { error: 'Unauthorized' });

            try {
                // Verify the API key belongs to user's account
                const existingKey = await prisma.apiKey.findFirst({
                    where: { id, accountId }
                });

                if (!existingKey) {
                    return fail(404, { error: 'API key not found' });
                }

                // Generate new key and update
                const newKey = generateId(32);
                await prisma.apiKey.update({
                    where: { id },
                    data: {
                        key: newKey,
                        lastUsedAt: null // Reset last used time
                    }
                });

                logger.info(`API key ${id} regenerated successfully`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'ApiKey',
                    recordId: id,
                    oldData: { key: '[REDACTED]' },
                    newData: { key: '[REGENERATED]' },
                    userId,
                    ipAddress: '',
                    prisma
                });

                return {
                    success: true,
                    apiKey: newKey // Return new key
                };
            } catch (err) {
                logger.error('Error regenerating API key:', { error: err });
                return fail(500, { error: 'Failed to regenerate API key' });
            }
        },
        [SystemRole.USER]
    ),

    /**
     * Delete an API Key
     */
    delete: restrict(
        async ({ request, locals, cookies }: AuthenticatedEvent) => {
            const form = await request.formData();
            const id = form.get('id') as string | null;

            if (!id) return fail(400, { error: 'API key ID is required' });

            const accountId = getCurrentAccountId(cookies, locals);
            const userId = locals.user?.id;

            if (!accountId || !userId) return fail(401, { error: 'Unauthorized' });

            try {
                // Verify the API key belongs to user's account
                const existingKey = await prisma.apiKey.findFirst({
                    where: { id, accountId }
                });

                if (!existingKey) {
                    return fail(404, { error: 'API key not found' });
                }

                // Delete the API key
                await prisma.apiKey.delete({
                    where: { id }
                });

                logger.info('API key deleted successfully:', { apiKeyId: id });

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'ApiKey',
                    recordId: id,
                    oldData: { id, name: existingKey.name },
                    newData: null,
                    userId,
                    ipAddress: '',
                    prisma
                });

                return { success: true };
            } catch (err) {
                logger.error('Error deleting API key:', { error: err });
                return fail(500, { error: 'Failed to delete API key' });
            }
        },
        [SystemRole.USER]
    )
};
