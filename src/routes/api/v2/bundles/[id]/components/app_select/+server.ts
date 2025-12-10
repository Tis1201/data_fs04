import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';

/**
 * GET /api/v2/bundles/[id]/components/app_select
 * Get available resources for app selection (excludes already-added apps)
 * 
 * This is a UI helper endpoint that:
 * - Fetches resources suitable for bundle apps
 * - Excludes resources already in the bundle
 * - Supports pagination, search, and filtering
 * - Uses the table data fetcher for consistency
 * 
 * Query params: Standard table params (page, per_page, search, sort, order, filters)
 */
export const GET = unifiedEndpoint(
  async ({ context, event, params }) => {
    const { prisma } = context;
    const { id: bundleId } = params;
    const url = event.url;

    const tableOptions = {
      modelName: 'resource',
      searchableFields: ['name', 'id', 'type', 'format', 'packageName'],
      allowedFilters: ['types', 'targets', 'formats'],
      defaultSortField: 'name',
      defaultSortOrder: 'asc' as const,
      defaultPerPage: 5,
      filterMappings: {
        types: { field: 'type', operator: 'in' },
        targets: { field: 'target', operator: 'in' },
        formats: { field: 'format', operator: 'in' }
      }
    };

    // Exclude already-added resources for this bundle
    const existing = await prisma.bundleApp.findMany({
      where: { bundleId },
      select: { resourceId: true }
    });
    const excludeIds = new Set(existing.map((e: { resourceId: string }) => e.resourceId));

    // Get pagination params
    const perPage = Number(url.searchParams.get('per_page') || tableOptions.defaultPerPage);
    const current_page = Number(url.searchParams.get('page') || 1);

    // Get base totals
    const baseMetaResult = await fetchTableData({ prisma }, url, tableOptions as any);
    const baseTotal = Number(
      ((baseMetaResult as any)?.meta?.pagination?.total_records) ??
        ((baseMetaResult as any)?.meta?.total) ??
        0
    );

    // Fetch enough records to fill page after filtering
    const requiredCount = current_page * perPage;
    let fetchSize = Math.max(requiredCount, perPage * 2);
    let filteredRecords: any[] = [];
    let safety = 0;

    while (safety < 6) {
      const adjustedUrl = new URL(url);
      adjustedUrl.searchParams.set('page', '1');
      adjustedUrl.searchParams.set('per_page', String(fetchSize));

      const batch = await fetchTableData({ prisma }, adjustedUrl, tableOptions as any);
      const records = (batch.records || []) as any[];
      filteredRecords = records.filter((r: any) => !excludeIds.has(r.id));

      if (filteredRecords.length >= requiredCount || records.length < fetchSize) {
        break;
      }
      fetchSize += perPage;
      safety += 1;
    }

    // Compute final page slice
    const startIndex = (current_page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const pageRecords = filteredRecords.slice(startIndex, endIndex);

    // Build meta
    const totalFiltered = filteredRecords.length;
    const totalPages = Math.ceil(totalFiltered / perPage);

    return successResponse({
      records: pageRecords,
      meta: {
        pagination: {
          current_page,
          per_page: perPage,
          total_records: totalFiltered,
          total_pages: totalPages,
          has_next: current_page < totalPages,
          has_prev: current_page > 1
        },
        total: baseTotal,
        excluded: excludeIds.size
      }
    });
  },
  { permission: 'bundle.edit' }
);

