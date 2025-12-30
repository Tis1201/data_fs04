import { error } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrictModule, type AuthenticatedLoadEvent, type ModuleAuthenticatedEvent } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType, CompanyStatus } from '$lib/constants/system';
import { getUserModulePermissions } from '$lib/server/security/modulePermissions';

export const load: PageServerLoad = restrictModule(
    async ({ url, locals }: AuthenticatedLoadEvent) => {
        try {
            // Get query parameters for filtering, sorting, and pagination
            const search = url.searchParams.get('search') || '';
            const page = parseInt(url.searchParams.get('page') || '1');
            const perPage = parseInt(url.searchParams.get('per_page') || '10');
            const sortField = url.searchParams.get('sort') || 'createdAt';
            const sortOrder = url.searchParams.get('order') || 'desc';
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
                    { contactEmail: { contains: search, mode: 'insensitive' } }
                ];
            }
            
            // Add status filter if provided
            if (statuses.length > 0) {
                where.status = { in: statuses };
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
                where: { isSystem: false },
                select: {
                    id: true,
                    name: true
                },
                orderBy: {
                    name: 'asc'
                }
            });

            // Get module permissions for frontend
            let modulePermissions = (locals as any).modulePermissions || {};
            const currentAccountId = (locals as any).currentAccount?.account?.id;
            if (Object.keys(modulePermissions).length === 0 && currentAccountId && locals.user?.id) {
                try {
                    modulePermissions = await getUserModulePermissions(locals.user.id, currentAccountId);
                } catch (e) { /* ignore */ }
            }

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
                },
                modulePermissions,
                user: locals.user
            };
        } catch (err) {
            logger.error(`Error loading companies:, ${err}` );
            throw error(500, 'Failed to load companies');
        }
    },
    'COMPANIES',
    { action: 'VIEW' }
);

export const actions: Actions = {
    deleteCompany: restrictModule(
        async ({ request, locals, auth, getClientAddress }: ModuleAuthenticatedEvent) => {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();

            if (!id) {
                return { success: false, error: 'Company ID is required' };
            }

            try {
                const company = await locals.prisma.company.delete({
                    where: { id }
                });

                logger.info(`Company deleted: ${id}`);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Company',
                    recordId: id,
                    oldData: company,
                    newData: null,
                    userId: locals.user?.id ?? auth?.user?.id ?? '',
                    ipAddress: (locals as any).ipAddress ?? getClientAddress?.() ?? 'unknown',
                    prisma: locals.prisma
                })

                return { success: true };
            } catch (err) {
                logger.error('Error deleting company:', { error: err });
                return { success: false, error: 'Failed to delete company' };
            }
        },
        'COMPANIES',
        { action: 'DELETE' }
    ),
    
    toggleStatus: restrictModule(
        async ({ request, locals, auth, getClientAddress }: ModuleAuthenticatedEvent) => {
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

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'Company',
                    recordId: id,
                    oldData: {status: status == CompanyStatus.ACTIVE ? CompanyStatus.INACTIVE : CompanyStatus.ACTIVE},
                    newData: {status},
                    userId: locals.user?.id ?? auth?.user?.id ?? '',
                    ipAddress: (locals as any).ipAddress ?? getClientAddress?.() ?? 'unknown',
                    prisma: locals.prisma
                })

                return { success: true, company };
            } catch (err) {
                logger.error('Error updating company status:', { error: err });
                return { success: false, error: 'Failed to update company status' };
            }
        },
        'COMPANIES',
        { action: 'EDIT' }
    )
};
