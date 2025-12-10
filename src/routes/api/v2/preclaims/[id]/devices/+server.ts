import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

/**
 * GET /api/v2/preclaims/[id]/devices
 * Get devices for a preclaim set
 * 
 * Uses the shared table data fetcher for consistency with UI components
 * 
 * Query params: Standard table params (page, per_page, search, sort, order, filters)
 * 
 * Returns preclaim devices with status and claim information
 */
export const GET = unifiedEndpoint(
  async ({ context, params, event }) => {
    const { prisma } = context;
    const { id } = params;
    const url = event.url;

    // Normalize query params to the shared table utils convention
    // Client sends sort_field/sort_order; map them to sort/order
    const normalizedUrl = new URL(url);
    const sortFieldParam = url.searchParams.get('sort_field');
    const sortOrderParam = url.searchParams.get('sort_order');
    if (sortFieldParam) normalizedUrl.searchParams.set('sort', sortFieldParam);
    if (sortOrderParam) normalizedUrl.searchParams.set('order', sortOrderParam);

    // Use the shared fetchTableData utility for consistency
    const result = await fetchTableData<any>(
      { prisma },
      normalizedUrl,
      {
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
          status: {
            field: 'status',
            operator: 'equals',
            valueTransformer: (value: string) => value.toUpperCase()
          }
        }
      }
    );

    // Preserve the response shape expected by the table component
    return json({
      records: result.records,
      pagination: result.meta.pagination,
      sort: result.meta.sort
    });
  },
  { permission: 'preclaim.view' }
);
