import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '../../admin/users/schema';
import { logger } from '$lib/server/logger';

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
                    { path: { contains: searchLower } }
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
                        type: true,
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
    deleteResource: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return { success: false, error: 'Resource ID is required' };
            }

            try {
                // Try to delete the resource - Zenstack will automatically check access permissions
                // If the user doesn't have access, Zenstack will throw an error
                await locals.prisma.resource.delete({
                    where: { id }
                });

                logger.info(`Resource deleted: ${id} by user ${locals.user.id}`);
                return { success: true };
            } catch (err) {
                logger.error(`Error deleting resource: ${err}`);
                return { success: false, error: 'Failed to delete resource' };
            }
        },
        [SystemRole.USER]
    )
};
