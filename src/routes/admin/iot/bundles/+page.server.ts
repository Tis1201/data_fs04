import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { bundleTableOptions, loadBundles, deleteBundle } from '$lib/bundles/server';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// Use shared table options
const table_options = bundleTableOptions;

/*******************************************************************************************
 * 
 *  Load Block
 * 
 *******************************************************************************************/
export const load = restrict(
    async ({ url, locals }) => {
        try {
            return await loadBundles(locals, url);
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
                const result = await deleteBundle(locals, id);
                if ((result as any).notFound) return fail(404, { error: 'Bundle not found' });
                if ((result as any).cannotDelete) return fail(400, { error: 'Cannot delete a published or in-progress bundle' });
                return { success: true };
            } catch (e: any) {
                logger.error(`Error deleting bundle: ${e?.message || String(e)}`);
                return fail(500, { error: 'Failed to delete bundle' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to access this action
    )
};
