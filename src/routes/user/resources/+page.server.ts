import { error, fail, redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict, type AuthenticatedLoadEvent, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deleteFileFromCloudStorage, getStorageConfig } from '$lib/server/storage';
import {
	resourceVisibilityOrForAccount,
	whereNotPublicDeveloperCatalog
} from '$lib/server/api/unifiedEndpoint';

export const load = restrict(
    async (event: AuthenticatedLoadEvent) => {
        const { url, locals, cookies } = event;
        try {
            // Sync URL: redirect to add default sort params when missing (but not when user explicitly unsorted)
            const hasSortParams = url.searchParams.has('sort_field') && url.searchParams.has('sort_order');
            const explicitUnsort = url.searchParams.get('sort') === 'default';
            if (!hasSortParams && !explicitUnsort) {
                const target = new URL(url.href);
                target.searchParams.set('sort_field', 'createdAt');
                target.searchParams.set('sort_order', 'desc');
                if (!target.searchParams.has('page')) target.searchParams.set('page', '1');
                throw redirect(302, target.pathname + target.search);
            }

            // Scope to current account only (switch-account aware)
            const currentAccountId =
                (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
                cookies.get('current_account_id');

            if (!currentAccountId) {
                return {
                    resources: [],
                    accounts: [],
                    resourceTypes: [],
                    storageConfig: getStorageConfig(),
                    meta: {
                        pagination: { page: 1, per_page: 10, total_records: 0, total_pages: 0 },
                        sort: { field: 'createdAt', order: 'desc' as const }
                    },
                    filters: { types: [] as string[] }
                };
            }

            // Get query parameters for filtering, sorting, and pagination
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = explicitUnsort ? null : (url.searchParams.get('sort_field') || 'createdAt');
            const sortOrder = explicitUnsort ? null : (url.searchParams.get('sort_order') || 'desc');
            const types = url.searchParams.get('types')?.split(',').filter(Boolean) || [];

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            const andClauses: Record<string, unknown>[] = [
                { OR: resourceVisibilityOrForAccount(currentAccountId) },
                whereNotPublicDeveloperCatalog
            ];

            if (search) {
                const searchLower = search.toLowerCase();
                const insensitive = { contains: searchLower, mode: 'insensitive' as const };
                andClauses.push({
                    OR: [
                        { name: insensitive },
                        { id: { contains: searchLower } },
                        { type: insensitive },
                        { path: insensitive },
                        { packageName: insensitive }
                    ]
                });
            }

            if (types.length > 0) {
                andClauses.push({ type: { in: types } });
            }

            const where: Record<string, unknown> = { AND: andClauses };

            const effectiveSortField = sortField || 'createdAt';
            const effectiveSortOrder = sortOrder || 'desc';

            // Query resources with filtering, sorting, and pagination (scoped to current account)
            const [resources, totalResources] = await Promise.all([
                locals.prisma.resource.findMany({
                    where,
                    orderBy: {
                        [effectiveSortField]: effectiveSortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        type: true,
                        target: true,
                        version: true,
                        versionCode: true,
                        signature: true,
                        releaseType: true,
                        format: true,
                        packageName: true,
                        path: true,
                        size: true,
                        createdAt: true,
                        updatedAt: true,
                        createdBy: true,
                        updatedBy: true,
                        accountId: true,
                        shareScope: true,
                        sharedWithAccounts: { select: { accountId: true } }
                    } as any
                }),
                locals.prisma.resource.count({ where })
            ]);

            const resourcesForClient = resources.map((r: any) => {
                const level = r.accountId === currentAccountId ? 'owner' : 'shared_read';
                const { sharedWithAccounts: _sw, ...rest } = r;
                return { ...rest, access: level };
            });

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalResources / perPage);

            // Accounts: only current account (for display; filter is fixed to current account)
            const currentAccount = await locals.prisma.account.findUnique({
                where: { id: currentAccountId },
                select: { id: true, name: true }
            });
            const accounts = currentAccount ? [currentAccount] : [];

            const resourceTypesRows = await locals.prisma.resource.findMany({
                where: {
                    AND: [
                        { OR: resourceVisibilityOrForAccount(currentAccountId) },
                        whereNotPublicDeveloperCatalog
                    ]
                },
                select: { type: true },
                distinct: ['type'],
                orderBy: { type: 'asc' }
            });
            const resourceTypes = resourceTypesRows.map((rt) => rt.type);

            const storageConfig = getStorageConfig();

            // Return the data (meta.pagination + meta.sort for design-system DataTable)
            return {
                resources: resourcesForClient,
                accounts,
                resourceTypes,
                storageConfig,
                meta: {
                    pagination: {
                        page,
                        per_page: perPage,
                        total_records: totalResources,
                        total_pages: totalPages
                    },
                    sort: {
                        field: sortField ?? null,
                        order: (explicitUnsort ? null : (sortOrder ?? 'desc')) as string | null
                    }
                },
                filters: {
                    types: types
                }
            };
        } catch (err) {
            if (isRedirect(err)) throw err;
            logger.error(`Error loading resources: ${err instanceof Error ? err.message : String(err)}`);
            throw error(500, 'Failed to load resources');
        }
    },
    [SystemRole.USER] // Allow user role to access this route
);

export const actions: Actions = {
    delete: restrict(
        async (event: AuthenticatedEvent) => {
            const { request, locals, cookies } = event;
            try {
                const formData = await request.formData();
                const id = formData.get('id')?.toString();

                if (!id) {
                    return fail(400, { type: 'error', message: 'Resource ID is required' });
                }

                const currentAccountId =
                    (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
                    cookies.get('current_account_id');

                if (!currentAccountId) {
                    return fail(403, { type: 'error', message: 'No account context' });
                }

                const resource = await locals.prisma.resource.findUnique({
                    where: { id },
                    select: { path: true, accountId: true }
                });

                if (!resource) {
                    return fail(404, { type: 'error', message: 'Resource not found' });
                }

                if (resource.accountId !== currentAccountId) {
                    return fail(403, { type: 'error', message: 'You do not have access to delete this resource' });
                }

                // BundleApp uses onDelete: SetNull - resource can be deleted; bundles will show snapshot + "Resource deleted"

                if (resource.path) {
                    try {
                        await deleteFileFromCloudStorage(resource.path);
                        logger.info(`Successfully deleted file from cloud storage: ${resource.path}`);
                    } catch (storageErr) {
                        logger.error(`Failed to delete file from cloud storage: ${storageErr}`);
                    }
                }

                await locals.prisma.resource.delete({ where: { id } });

                logger.info(`Resource deleted: ${id} by user ${locals.user?.id ?? 'unknown'}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Resource',
                    recordId: id,
                    oldData: null,
                    newData: null,
                    userId: locals.user?.id ?? 'unknown',
                    ipAddress: locals.requestContext?.ip ?? 'unknown',
                    prisma: locals.prisma
                });

                return { type: 'success' };
            } catch (err: unknown) {
                logger.error(`Error deleting resource: ${err}`);
                return fail(500, { type: 'error', message: 'Failed to delete resource' });
            }
        },
        [SystemRole.USER]
    )
};
