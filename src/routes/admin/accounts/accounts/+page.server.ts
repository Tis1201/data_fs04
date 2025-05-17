import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
    try {
        // Get query parameters for filtering, sorting, and pagination
        const search = url.searchParams.get('search') || '';
        const page = parseInt(url.searchParams.get('page') || '1');
        const perPage = parseInt(url.searchParams.get('per_page') || '10');
        const sortField = url.searchParams.get('sort_field') || 'createdAt';
        const sortOrder = url.searchParams.get('sort_order') || 'desc';
        const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];

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
                { slug: { contains: search, mode: 'insensitive' } }
            ];
        }
        
        // Add status filter if provided
        if (statuses.length > 0) {
            where.status = { in: statuses };
        }

        // Query accounts with filtering, sorting, and pagination
        const [accounts, totalAccounts] = await Promise.all([
            locals.prisma.account.findMany({
                where,
                orderBy: {
                    [sortField]: sortOrder
                },
                skip,
                take,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    description: true,
                    logoUrl: true,
                    _count: {
                        select: {
                            companies: true,
                            members: true,
                            devices: true
                        }
                    }
                }
            }),
            locals.prisma.account.count({ where })
        ]);

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalAccounts / perPage);

        return {
            accounts,
            pagination: {
                page,
                per_page: perPage,
                total_records: totalAccounts,
                total_pages: totalPages
            },
            sort: {
                field: sortField,
                order: sortOrder
            }
        };
    } catch (err) {
        console.error('Error loading accounts:', err);
        throw error(500, 'Failed to load accounts');
    }
};

export const actions: Actions = {
    deleteAccount: async ({ request, locals }) => {
        const formData = await request.formData();
        const id = formData.get('id')?.toString();

        if (!id) {
            return { success: false, error: 'Account ID is required' };
        }

        try {
            await locals.prisma.account.delete({
                where: { id }
            });

            return { success: true };
        } catch (err) {
            console.error('Error deleting account:', err);
            return { success: false, error: 'Failed to delete account' };
        }
    },
    
    toggleStatus: async ({ request, locals }) => {
        const formData = await request.formData();
        const id = formData.get('id')?.toString();
        const status = formData.get('status')?.toString();

        if (!id || !status) {
            return { success: false, error: 'Account ID and status are required' };
        }

        try {
            await locals.prisma.account.update({
                where: { id },
                data: { status }
            });

            return { success: true };
        } catch (err) {
            console.error('Error updating account status:', err);
            return { success: false, error: 'Failed to update account status' };
        }
    }
};
