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
    [SystemRole.USER] // Only allow admin role to access this route
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
                
                // If bundle is PUBLISHED/IN_PROGRESS, recompute status from waves to see if it's actually finished
                if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
                    try {
                        const waves = await locals.prisma.bundleWave.findMany({
                            where: { bundleId: id },
                            select: { status: true }
                        });
                        if (Array.isArray(waves) && waves.length > 0) {
                            const anyInProgress = waves.some((w) => w.status === 'IN_PROGRESS' || w.status === 'PENDING');
                            const anyFailed = waves.some((w) => w.status === 'FAILED');
                            const allDone = waves.every((w) => ['COMPLETED', 'FAILED'].includes(w.status));
                            if (!anyInProgress && allDone) {
                                const computedStatus = anyFailed ? 'FAILED' : 'COMPLETED';
                                await locals.prisma.bundle.update({ where: { id }, data: { status: computedStatus } });
                                bundle.status = computedStatus as any;
                            }
                        }
                    } catch (e) {
                        // Ignore recompute errors; fall back to guard
                    }
                    // Guard again after recompute
                    if (bundle.status === 'PUBLISHED' || bundle.status === 'IN_PROGRESS') {
                        return fail(400, { error: 'Cannot delete a published or in-progress bundle' });
                    }
                }

                // Delete related records first using transaction
                await locals.prisma.$transaction(async (tx) => {
                    // Remove dependent rows; cascades also cover most relations, but delete explicitly for clarity
                    await tx.bundleApp.deleteMany({ where: { bundleId: id } });
                    await tx.bundleDeviceProgress.deleteMany({ where: { bundleId: id } });
                    await tx.bundleWave.deleteMany({ where: { bundleId: id } });
                    await tx.bundleDevice.deleteMany({ where: { bundleId: id } });
                    await tx.bundle.delete({ where: { id } });
                    await logAudit({
                        actionType: AuditActionType.DELETE,
                        tableName: 'Bundle',
                        recordId: id,
                        oldData: bundle,
                        newData: null,
                        userId: locals.user.id,
                        ipAddress: locals.ipAddress,
                        prisma: tx
                    });
                });
                
                return { success: true };
            } catch (e: any) {
                logger.error(`Error deleting bundle: ${e?.message || String(e)}`);
                return fail(500, { error: 'Failed to delete bundle' });
            }
        },
        [SystemRole.USER] // Only allow admin role to access this action
    )
};
