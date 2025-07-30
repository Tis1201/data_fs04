import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// Define table options for Bundles
const table_options = {
    modelName: 'bundle',
    searchableFields: ['name', 'description', 'version', 'os'],
    allowedFilters: ['status', 'os'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'status': { field: 'status', operator: 'equals' },
        'os': { field: 'os', operator: 'equals' }
    }
};

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }) => {
        try {
            // Use the reusable fetchTableData function with our table options
            const result = await fetchTableData(locals, url, table_options);
            
            return {
                bundles: result.records,
                meta: result.meta
            };
        } catch (e) {
            logger.error(`Error loading bundles: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load bundles');
        }
    },
    [SystemRole.ADMIN] // Only allow admin role to access this route
) satisfies PageServerLoad;

/*******************************************************************************************
 * 
 *  Actions Block
 * 
 *******************************************************************************************/
export const actions = {
    /*******************************************************************************************
     * Delete
     ******************************************************************************************/
    delete: restrict(
        async ({ request, locals }) => {
            try {
                // Get the bundle ID from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Bundle ID is required' });
                }

                // Check if bundle exists and can be deleted
                const bundle = await locals.prisma.bundle.findUnique({
                    where: { id },
                    include: {
                        apps: true,
                        waves: true
                    }
                });
                
                if (!bundle) {
                    return fail(404, { error: 'Bundle not found' });
                }
                
                // Check if bundle can be deleted (e.g., not in progress)
                if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
                    return fail(400, { error: 'Cannot delete a published or in-progress bundle' });
                }

                // Delete related records first using transaction
                await locals.prisma.$transaction([
                    locals.prisma.bundleApp.deleteMany({ where: { bundleId: id } }),
                    locals.prisma.bundleWave.deleteMany({ where: { bundleId: id } }),
                    locals.prisma.bundle.delete({ where: { id } }),
                    logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'Bundle',
                        recordId: id,
                        oldData: bundle,
                        newData: null,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: locals.prisma
                    })
                ]);
                
                return { success: true };
            } catch (e) {
                logger.error(`Error deleting bundle: ${JSON.stringify(e)}`);
                return fail(500, { error: 'Failed to delete bundle' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
