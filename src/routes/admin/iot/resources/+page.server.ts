import type { PageServerLoad } from './$types';
import { error, fail, json } from '@sveltejs/kit';
import { z } from 'zod';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import type { Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData, deleteRecord } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

// Define table options for Resources
const table_options = {
    modelName: 'resource',
    searchableFields: ['name', 'id', 'type', 'format', 'packageName'],
    allowedFilters: ['types', 'targets', 'formats'],
    defaultSortField: 'createdAt',
    defaultSortOrder: 'desc' as const,
    defaultPerPage: 10,
    // Define filter mappings at the table level
    filterMappings: {
        'types': { field: 'type', operator: 'in' },
        'targets': { field: 'target', operator: 'in' },
        'formats': { field: 'format', operator: 'in' }
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
                resources: result.records,
                meta: result.meta
            };
        } catch (e) {
            logger.error(`Error loading resources: ${JSON.stringify(e)}`);
            throw error(500, 'Failed to load resources');
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
                // Get the resource ID from form data
                const data = await request.formData();
                const id = data.get('id')?.toString();
                
                if (!id) {
                    return fail(400, { error: 'Resource ID is required' });
                }

                // Get the authenticated user
                const auth = await locals.auth.validate();
                if (!auth) {
                    return fail(401, { error: 'Unauthorized' });
                }

                // Delete the resource
                const result = await deleteRecord(locals, 'resource', id);

                await logAudit({
                    actionType: AuditActionType.DELETE,
                    tableName: 'Resource',
                    recordId: id,
                    oldData: null,
                    newData: null,
                    userId: locals.user.id,
                    ipAddress: locals.ipAddress,
                    prisma: locals.prisma
                })
                
                if (result.success) {
                    return { success: true, message: 'Resource deleted successfully' };
                } else {
                    return fail(500, { error: result.error || 'Failed to delete resource' });
                }
            } catch (e) {
                logger.error(`Error deleting resource: ${JSON.stringify(e)}`);
                return fail(500, { error: 'An unexpected error occurred' });
            }
        },
        [SystemRole.ADMIN] // Only allow admin role to delete
    )
};
