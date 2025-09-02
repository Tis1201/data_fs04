import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

export const GET: RequestHandler = restrict(async ({ url, params, locals }) => {
  const { id } = params; // preclaim set id

  try {
    // Normalize query params to the shared table utils convention
    // Our client currently sends sort_field/sort_order; map them to sort/order
    const normalizedUrl = new URL(url);
    const sortFieldParam = url.searchParams.get('sort_field');
    const sortOrderParam = url.searchParams.get('sort_order');
    if (sortFieldParam) normalizedUrl.searchParams.set('sort', sortFieldParam);
    if (sortOrderParam) normalizedUrl.searchParams.set('order', sortOrderParam);

    // Use the shared fetchTableData utility for consistency
    const result = await fetchTableData<any>(locals, normalizedUrl, {
      modelName: 'preclaimDevice',
      searchableFields: ['id', 'deviceId', 'macId', 'name'],
      allowedFilters: ['status'],
      defaultSortField: 'createdAt',
      defaultSortOrder: 'desc',
      defaultPerPage: 10,
      select: {
        id: true,
        deviceId: true,
        macId: true,
        name: true,
        status: true,
        claimedAt: true,
        createdAt: true
      },
      // Ensure we only fetch claims for this preclaim set
      baseWhere: { setId: id },
      // Map URL filters to DB fields/operators
      filterMappings: {
        status: { field: 'status', operator: 'in' }
      }
    });

    // Preserve the response shape expected by the table component
    return json({
      records: result.records,
      pagination: result.meta.pagination,
      sort: result.meta.sort
    });
  } catch (e: any) {
    logger.error(`Failed to load preclaim claims: ${e?.message || String(e)}`);
    throw error(500, 'Failed to load claims');
  }
}, [SystemRole.USER]);
