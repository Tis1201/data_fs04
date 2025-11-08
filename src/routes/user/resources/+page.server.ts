import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { deleteFileFromCloudStorage } from '$lib/server/storage';

export const load = restrict(
    async ({ url, locals }) => {
        try {
            // Get query parameters for filtering, sorting, and pagination
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort_field') || 'createdAt';
            const sortOrder = url.searchParams.get('sort_order') || 'desc';
            const types = url.searchParams.get('types')?.split(',').filter(Boolean) || [];
            const accountId = url.searchParams.get('accountId') || '';

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build the where clause for filtering
            const where: any = {};
            
            // Add search filter if provided
            if (search) {
                // Convert search to lowercase for case-insensitive comparison
                const searchLower = search.toLowerCase();
                where.OR = [
                    { name: { contains: searchLower } },
                    { id: { contains: searchLower } },
                    { path: { contains: searchLower } },
                    { packageName: { contains: searchLower } }
                ];
            }
            
            // Add type filter if provided
            if (types.length > 0) {
                where.type = { in: types };
            }
            
            // Add account filter if provided
            if (accountId) {
                where.accountId = accountId;
            }

            // Query resources with filtering, sorting, and pagination
            const [resources, totalResources] = await Promise.all([
                locals.prisma.resource.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
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
                        format: true,
                        packageName: true,
                        path: true,
                        size: true,
                        createdAt: true,
                        updatedAt: true,
                        createdBy: true,
                        updatedBy: true,
                        accountId: true
                    }
                }),
                locals.prisma.resource.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalResources / perPage);
                
            // Get accounts for filtering - Zenstack will automatically filter based on access policies
            const accounts = await locals.prisma.account.findMany({
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Get unique resource types for filtering - Zenstack will automatically filter based on access policies
            const resourceTypes = await locals.prisma.resource.findMany({
                select: {
                    type: true
                },
                distinct: ['type'],
                orderBy: {
                    type: 'asc'
                }
            });

            // Return the data
            return {
                resources,
                accounts,
                resourceTypes: resourceTypes.map(rt => rt.type),
                meta: {
                    totalItems: totalResources,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {
                    types: types
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error(`Error loading resources:, ${err}` );
            throw error(500, 'Failed to load resources');
        }
    },
    [SystemRole.USER] // Allow user role to access this route
);

export const actions: Actions = {
    delete: restrict(
        async ({ request, locals, url }) => {
            try {
                const formData = await request.formData();
                const id = formData.get('id')?.toString();

                if (!id) {
                    return fail(400, { error: 'Resource ID is required' });
                }

                // Get the resource first to get the file path
                const resource = await locals.prisma.resource.findUnique({
                    where: { id },
                    select: { path: true }
                });

                if (!resource) {
                    return fail(404, { error: 'Resource not found' });
                }

                // Delete the file from cloud storage first
                if (resource.path) {
                    try {
                        await deleteFileFromCloudStorage(resource.path);
                        logger.info(`Successfully deleted file from cloud storage: ${resource.path}`);
                    } catch (error) {
                        logger.error(`Failed to delete file from cloud storage: ${error}`);
                        // Continue with database deletion even if file deletion fails
                    }
                }

                // Try to delete the resource - Zenstack will automatically check access permissions
                // If the user doesn't have access, Zenstack will throw an error
                await locals.prisma.resource.delete({
                    where: { id }
                });

                logger.info(`Resource deleted: ${id} by user ${locals.user.id}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Resource',
                    recordId: id,
                    oldData: null,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                });

                // Redirect to refresh the page and show updated list
                throw redirect(303, url.pathname);
            } catch (err) {
                // If it's a redirect, re-throw it
                if (err && typeof err === 'object' && 'status' in err && err.status === 303) {
                    throw err;
                }
                logger.error(`Error deleting resource: ${err}`);
                return fail(500, { error: 'Failed to delete resource' });
            }
        },
        [SystemRole.USER]
    )
};
