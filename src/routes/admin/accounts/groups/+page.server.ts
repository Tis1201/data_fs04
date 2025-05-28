import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
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
            const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
            const accountId = url.searchParams.get('accountId') || '';

            // Calculate pagination values
            const skip = (page - 1) * perPage;
            const take = perPage;

            // Build the where clause for filtering
            const where: any = {};
            
            // Add search filter if provided
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            // Note: Group model doesn't have a status field in the schema
            
            // Add account filter if provided
            if (accountId) {
                where.accountId = accountId;
            }

            // Query groups with filtering, sorting, and pagination
            const [groups, totalGroups] = await Promise.all([
                locals.prisma.group.findMany({
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
                        createdAt: true,
                        updatedAt: true,
                        accountId: true,
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                members: true
                            }
                        }
                    }
                }),
                locals.prisma.group.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalGroups / perPage);

            // Note: Group model doesn't have a status field in the schema
                
            // Get all accounts for filtering
            const accounts = await locals.prisma.account.findMany({
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Return the data
            return {
                groups,
                accounts,
                meta: {
                    totalItems: totalGroups,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {},

                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error(`Error loading groups:, ${err}` );
            throw error(500, 'Failed to load groups');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
);

export const actions: Actions = {
    deleteGroup: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return { success: false, error: 'Group ID is required' };
            }

            try {
                await locals.prisma.group.delete({
                    where: { id }
                });

                logger.info(`Group deleted: ${id}`);
                return { success: true };
            } catch (err) {
                logger.error('Error deleting group:', err);
                return { success: false, error: 'Failed to delete group' };
            }
        },
        [SystemRole.ADMIN]
    ),
    

};
