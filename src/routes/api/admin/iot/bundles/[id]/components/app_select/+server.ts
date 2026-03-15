import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';

/**
 * App Selection API Endpoint for Bundle Components
 */

// Define table options for Resources in the app select context
const tableOptions = {
  modelName: 'resource',
  searchableFields: ['name', 'id', 'type', 'format', 'packageName'],
  allowedFilters: ['types', 'targets', 'formats'],
  defaultSortField: 'name',
  defaultSortOrder: 'asc' as const,
  defaultPerPage: 5,
  filterMappings: {
    'types': { field: 'type', operator: 'in' },
    'targets': { field: 'target', operator: 'in' },
    'formats': { field: 'format', operator: 'in' }
  }
};

// Handle GET requests to fetch resources for app selection
export const GET = restrict(
  async ({ url, locals, params }: any) => {
    try {
      // Exclude already-added resources for this bundle
      const bundleId = params.id as string;
      const existing = await (locals.prisma as any).bundleApp.findMany({
        where: { bundleId },
        select: { resourceId: true }
      });
      const excludeIds = new Set(existing.map((e: { resourceId: string | null }) => e.resourceId).filter(Boolean) as string[]);

      // Requested pagination
      const perPage = Number(url.searchParams.get('per_page') || tableOptions.defaultPerPage);
      const current_page = Number(url.searchParams.get('page') || 1);

      // 1) Get base totals (without exclusion), needed for meta
      const baseMetaResult = await fetchTableData(locals, url, tableOptions as any);
      const baseTotal = Number(((baseMetaResult as any)?.meta?.pagination?.total_records) ?? ((baseMetaResult as any)?.meta?.total) ?? 0);

      // 2) Iteratively fetch enough records so that AFTER filtering we can fill the requested page
      // We always fetch from page=1 with increasing per_page so we have a stable slice window
      const requiredCount = current_page * perPage; // we need at least this many filtered records to fill page N
      let fetchSize = Math.max(requiredCount, perPage * 2); // start with at least 2 pages worth as a buffer
      let filteredRecords: any[] = [];
      let safety = 0;

      while (safety < 6) { // cap to avoid runaway loops (max ~12 pages worth via doubling)
        const adjustedUrl = new URL(url);
        adjustedUrl.searchParams.set('page', '1');
        adjustedUrl.searchParams.set('per_page', String(fetchSize));

        const batch = await fetchTableData(locals, adjustedUrl, tableOptions as any);
        const records = (batch.records || []) as any[];
        filteredRecords = records.filter((r: any) => !excludeIds.has(r.id));

        if (filteredRecords.length >= requiredCount || records.length < fetchSize) {
          // Either we have enough filtered records to fill the requested page,
          // or we've fetched all available records.
          break;
        }
        // Increase fetch size and try again
        fetchSize += perPage;
        safety += 1;
      }

      // 3) Compute final page slice from filtered results
      const startIndex = (current_page - 1) * perPage;
      const endIndex = startIndex + perPage;
      const pageRecords = filteredRecords.slice(startIndex, endIndex);

      // 4) Build meta after exclusion
      const total = Math.max(0, baseTotal - excludeIds.size);
      const last_page = Math.max(1, Math.ceil(total / perPage));

      logger.info(`App select pagination (iterative): page ${current_page}, perPage ${perPage}, fetched ${fetchSize}, filteredTotal=${filteredRecords.length}, pageRecords=${pageRecords.length}, total=${total}, last_page=${last_page}`);

      return json({
        resources: pageRecords,
        meta: {
          ...baseMetaResult.meta,
          total,
          last_page,
          pagination: {
            page: Math.min(current_page, last_page),
            per_page: perPage,
            total_records: total,
            total_pages: last_page
          }
        }
      });
    } catch (e: unknown) {
      logger.error(`Error loading resources for app select: ${typeof e === 'object' ? JSON.stringify(e) : String(e)}`);
      throw error(500, 'Failed to load resources');
    }
  },
  [SystemRole.ADMIN] // Only allow admin role to access this endpoint
) satisfies RequestHandler;

// Handle POST requests for adding an app to a bundle
export const POST = restrict(
  async ({ request, locals, params }: any) => {
    try {
      const { prisma } = locals;
      const data = await request.json();
      const { resourceId } = data;
      const bundleId = params.id;
      
      if (!resourceId) {
        throw error(400, 'Resource ID is required');
      }
      
      if (!bundleId) {
        throw error(400, 'Bundle ID is required');
      }
      
      // Check if the resource exists
      const resource = await prisma.resource.findUnique({
        where: { id: resourceId }
      });
      
      if (!resource) {
        throw error(404, 'Resource not found');
      }
      
      // Check if the bundle exists
      const bundle = await prisma.bundle.findUnique({
        where: { id: bundleId }
      });
      
      if (!bundle) {
        throw error(404, 'Bundle not found');
      }
      
      // Check if the resource is already in the bundle
      const existingBundleResource = await (prisma as any).bundleApp.findFirst({
        where: {
          bundleId,
          resourceId
        }
      });
      
      if (existingBundleResource) {
        throw error(400, 'Resource is already in the bundle');
      }
      
      const maxOrder = await (prisma as any).bundleApp.aggregate({
        where: { bundleId },
        _max: { order: true }
      });
      const order = (maxOrder._max?.order ?? 0) + 1;
      const userId = locals.user?.id ?? 'unknown';
      
      const bundleResource = await (prisma as any).bundleApp.create({
        data: {
          bundleId,
          resourceId,
          order,
          autoOpen: data.autoOpen || false,
          createdBy: userId,
          updatedBy: userId,
          resourceNameSnapshot: resource.name,
          resourcePackageNameSnapshot: resource.packageName,
          resourceVersionSnapshot: resource.version,
          resourceSizeSnapshot: resource.size,
          resourceFormatSnapshot: resource.format
        },
        include: { resource: true }
      });
      
      logger.info(`Resource added to bundle: ${resourceId} to ${bundleId}`);

      await logAudit({
            actionType: AuditActionType.INSERT,
            tableName: 'BundleApp',
            recordId: bundleResource.id,
            oldData: null,
            newData: bundleResource,
            userId: locals.user?.id,
            ipAddress: locals.ipAddress,
            prisma: prisma
        })
      
      return json({
        success: true,
        data: bundleResource
      });
    } catch (e: any) {
      logger.error(`Error adding resource to bundle: ${typeof e === 'object' ? JSON.stringify(e) : String(e)}`);
      if (e?.status) {
        throw error(e.status, e.message);
      }
      throw error(500, 'Failed to add resource to bundle');
    }
  },
  [SystemRole.ADMIN] // Only allow admin role to access this endpoint
) satisfies RequestHandler;

// Handle DELETE requests for removing an app from a bundle
export const DELETE = restrict(
  async ({ request, locals, params }: any) => {
    try {
      const { prisma } = locals;
      const data = await request.json();
      const { resourceId } = data;
      const bundleId = params.id;
      
      if (!resourceId) {
        throw error(400, 'Resource ID is required');
      }
      
      if (!bundleId) {
        throw error(400, 'Bundle ID is required');
      }
      
      // Check if the bundle resource exists
      const bundleResource = await (prisma as any).bundleApp.findFirst({
        where: {
          bundleId,
          resourceId
        }
      });
      
      if (!bundleResource) {
        throw error(404, 'Resource not found in bundle');
      }
      
      // Remove the resource from the bundle
      await (prisma as any).bundleApp.delete({
        where: {
          id: bundleResource.id
        }
      });
      
      logger.info(`Resource removed from bundle: ${resourceId} from ${bundleId}`);

      await logAudit({
            actionType: AuditActionType.DELETE,
            tableName: 'BundleApp',
            recordId: bundleResource.id,
            oldData: bundleResource,
            newData: null,
            userId: locals.user?.id,
            ipAddress: locals.ipAddress,
            prisma: prisma
        })
      
      return json({
        success: true
      });
    } catch (e: any) {
      logger.error(`Error removing resource from bundle: ${typeof e === 'object' ? JSON.stringify(e) : String(e)}`);
      if (e?.status) {
        throw error(e.status, e.message);
      }
      throw error(500, 'Failed to remove resource from bundle');
    }
  },
  [SystemRole.ADMIN] // Only allow admin role to access this endpoint
) satisfies RequestHandler;

// Handle unsupported HTTP methods
const fallback: RequestHandler = async ({ request }) => {
  throw error(405, `Method ${request.method} not allowed`);
};

export { fallback as PUT, fallback as HEAD, fallback as OPTIONS };
