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
            const sortField = url.searchParams.get('sort') || 'createdAt';
            const sortOrder = url.searchParams.get('order') || 'desc';
            const industries = url.searchParams.get('industries')?.split(',').filter(Boolean) || [];
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
                    { id: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            // Add status filter if provided (replacing industry filter)
            if (industries.length > 0) {
                where.status = { in: industries };
            }
            
            // Add account filter if provided
            if (accountId) {
                where.accountId = accountId;
            }

            // Query companies with filtering, sorting, and pagination
            const [companies, totalCompanies] = await Promise.all([
                locals.prisma.company.findMany({
                    where,
                    orderBy: {
                        [sortField]: sortOrder
                    },
                    skip,
                    take,
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        address: true,
                        contactEmail: true,
                        contactPhone: true,
                        createdAt: true,
                        updatedAt: true,
                        description: true,
                        accountId: true,
                        account: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                devices: true
                            }
                        }
                    }
                }),
                locals.prisma.company.count({ where })
            ]);

            // Calculate pagination metadata
            const totalPages = Math.ceil(totalCompanies / perPage);

            // Get all available statuses for filtering
            const statusesData = await locals.prisma.company.groupBy({
                by: ['status']
                // Removed the where clause with not: null that was causing the error
            });

            const availableStatuses = statusesData
                .map(item => item.status)
                .filter(Boolean)
                .sort();
                
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
                companies,
                accounts, // Add accounts for filtering
                meta: {
                    totalItems: totalCompanies,
                    itemsPerPage: perPage,
                    totalPages,
                    currentPage: page
                },
                filters: {
                    industries: availableStatuses // Using industries key for UI compatibility
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                }
            };
        } catch (err) {
            logger.error(`Error loading companies:, ${err}` );
            throw error(500, 'Failed to load companies');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
);

export const actions: Actions = {
    deleteCompany: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return { success: false, error: 'Company ID is required' };
            }

            try {
                await locals.prisma.company.delete({
                    where: { id }
                });

                logger.info(`Company deleted: ${id}`);
                return { success: true };
            } catch (err) {
                logger.error('Error deleting company:', err);
                return { success: false, error: 'Failed to delete company' };
            }
        },
        [SystemRole.ADMIN]
    ),
    
    toggleStatus: restrict(
        async ({ request, locals }) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const status = formData.get('status')?.toString();

            if (!id || !status) {
                return { success: false, error: 'Company ID and status are required' };
            }

            try {
                const company = await locals.prisma.company.update({
                    where: { id },
                    data: { status }
                });

                logger.info(`Company status updated: ${id} (${status})`);
                return { success: true, company };
            } catch (err) {
                logger.error('Error updating company status:', err);
                return { success: false, error: 'Failed to update company status' };
            }
        },
        [SystemRole.ADMIN]
    )
};
