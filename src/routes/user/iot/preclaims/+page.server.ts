import type { PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { deviceSchema } from '$lib/schemas/device';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { getStatusBeforeToggled } from '$lib/utils';
import { getEnhancedPrisma } from '$lib/server/prisma';

// Define table options for Preclaim Sets
const table_options = {
    modelName: 'preclaimSet',
    searchableFields: ['name', 'id', 'description'],
    allowedFilters: ['statuses'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'statuses': { field: 'status', operator: 'in' }
    },
    // Add user-specific filter to only show sets in user's accounts or created by the user
    additionalFilters: (locals: any) => {
        const userId = locals.auth?.user?.id;
        if (!userId) return {};

        return {
            OR: [
                { createdBy: userId },
                {
                    account: {
                        members: {
                            some: {
                                userId: userId
                            }
                        }
                    }
                }
            ]
        };
    }
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals, depends }: any) => {
        // Add a dependency key for invalidation
        depends('app:userPreclaimSets');
        
        // Get the authenticated user
        const auth = await locals.auth.validate();
        if (!auth?.user) {
            throw error(401, 'Unauthorized');
        }

        // Get enhanced Prisma client with user context
        const enhancedPrisma = getEnhancedPrisma({
            id: auth.user.id,
            systemRole: auth.user.systemRole || 'USER',
            accountMemberships: auth.user.accountMemberships || []
        });

        // Parse URL parameters for pagination and sorting
        const page = parseInt(url.searchParams.get('page') || '1');
        const per_page = parseInt(url.searchParams.get('per_page') || '10');
        const sortField = url.searchParams.get('sort_field') || 'createdAt';
        const sortOrder = url.searchParams.get('sort_order') || 'desc';
        const search = url.searchParams.get('search') || '';
        const statusFilter = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];

        // Build where conditions
        const where: any = {};
        
        // Add search conditions
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { id: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Add status filter
        if (statusFilter.length > 0) {
            where.status = { in: statusFilter };
        }

        // Get total count
        const totalRecords = await enhancedPrisma.preclaimSet.count({ where });

        // Get records with pagination and sorting
        const records = await enhancedPrisma.preclaimSet.findMany({
            where,
            skip: (page - 1) * per_page,
            take: per_page,
            orderBy: { [sortField]: sortOrder },
            include: {
                account: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        claims: true
                    }
                }
            }
        });

        const totalPages = Math.ceil(totalRecords / per_page);

        return {
            preclaimSets: records,
            meta: {
                pagination: {
                    page,
                    per_page,
                    total_records: totalRecords,
                    total_pages: totalPages
                },
                sort: {
                    field: sortField,
                    order: sortOrder
                },
                filters: {
                    search,
                    statuses: statusFilter
                }
            }
        };
    },
    [SystemRole.USER] // Restrict to authenticated users
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Toggle Status
     ******************************************************************************************/
    toggleStatus: restrict(
        async ({ request, locals }: any) => {
            try {
                // Get the preclaim set ID and new status from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                const status = data.get('status')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Preclaim Set ID is required' });
                }
                
                if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
                    return fail(400, { error: 'Invalid status value' });
                }
                
                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Get enhanced Prisma client with user context
                const enhancedPrisma = getEnhancedPrisma({
                    id: auth.user.id,
                    systemRole: auth.user.systemRole || 'USER',
                    accountMemberships: auth.user.accountMemberships || []
                });
                
                // Check if preclaim set exists and user has permission (ZenStack will handle authorization)
                const preclaimSet = await enhancedPrisma.preclaimSet.findFirst({
                    where: { id }
                });
                
                if (!preclaimSet) {
                    return fail(404, { error: 'Preclaim Set not found or you do not have permission to modify it' });
                }
                
                // Update the preclaim set status (ZenStack will enforce authorization)
                await enhancedPrisma.preclaimSet.update({
                    where: { id },
                    data: { 
                        status,
                        updatedAt: new Date() 
                    }
                });

                logger.info(`User ${auth.user.id} changed preclaim set ${id} status to ${status}`);

                await logAudit({
                    actionType: AuditActionType.UPDATE,
                    tableName: 'PreclaimSet',
                    recordId: id,
                    oldData: getStatusBeforeToggled(status),
                    newData: { status },
                    userId: auth.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: enhancedPrisma
                })
                
                return { success: true };
            } catch (err) {
                logger.error(`Error toggling preclaim set status: ${err}`);
                return fail(500, { error: 'Failed to update preclaim set status' });
            }
        },
        [SystemRole.USER] // Restrict to authenticated users
    )
};
