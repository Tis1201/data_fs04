import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';

// Define table options for Resources in the app select context
const tableOptions = {
  modelName: 'resource',
  searchableFields: ['name', 'id', 'type', 'format', 'packageName'],
  allowedFilters: ['types', 'targets', 'formats'],
  defaultSortField: 'name',
  defaultSortOrder: 'asc' as const,
  defaultPerPage: 10,
  filterMappings: {
    'types': { field: 'type', operator: 'in' },
    'targets': { field: 'target', operator: 'in' },
    'formats': { field: 'format', operator: 'in' }
  }
};

export const GET = restrict(
  async ({ url, locals }) => {
    try {
      // Use the reusable fetchTableData function with our table options
      const result = await fetchTableData(locals, url, tableOptions);
      
      return json({
        resources: result.records,
        meta: result.meta
      });
    } catch (e) {
      logger.error(`Error loading resources for app select: ${JSON.stringify(e)}`);
      throw error(500, 'Failed to load resources');
    }
  },
  [SystemRole.ADMIN] // Only allow admin role to access this endpoint
) satisfies RequestHandler;

// If you need to handle POST requests for app selection
// export const POST = restrict(
//   async ({ request, locals }) => {
//     // Handle app selection logic here
//   },
//   [SystemRole.ADMIN]
// ) satisfies RequestHandler;