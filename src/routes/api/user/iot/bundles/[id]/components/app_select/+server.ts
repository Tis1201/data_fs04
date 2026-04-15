import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { assertResourceRowInstallableByAccount } from '$lib/server/resources/resourceInstallAccess';
import {
	resourceVisibilityOrForAccount,
	whereNotPublicDeveloperCatalog
} from '$lib/server/api/unifiedEndpoint';

/**
 * App Selection API Endpoint for Bundle Components (User Side)
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

/** Allowed app formats per bundle target OS: Linux → deb, Windows → exe, Android → apk, others → deb */
function getFormatsByTargetOs(os: string | null | undefined): string[] {
  const osLower = (os ?? '').toLowerCase();
  if (osLower === 'linux') return ['deb'];
  if (osLower === 'windows') return ['exe'];
  if (osLower === 'android') return ['apk'];
  // macOS, darwin, apple, unknown, etc.
  return ['deb'];
}

// Handle GET requests to fetch resources for app selection
export const GET = restrict(
  async ({ url, locals, params }: any) => {
    try {
      // Exclude already-added resources for this bundle
      const bundleId = params.id as string;
      const bundle = await (locals.prisma as any).bundle.findUnique({
        where: { id: bundleId },
        select: { os: true }
      });
      const existing = await (locals.prisma as any).bundleApp.findMany({
        where: { bundleId },
        select: { resourceId: true }
      });
      const excludeIds = new Set(existing.map((e: { resourceId: string | null }) => e.resourceId).filter(Boolean) as string[]);

      // Filter formats by bundle target OS: macOS → cpk; Linux → deb, cpk; Android → apk
      const allowedFormats = getFormatsByTargetOs(bundle?.os);
      const currentAccountId = (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
      // Own-account apps plus catalog / explicitly shared apps (not PUBLIC_DEVELOPER catalog)
      const baseWhere: Record<string, unknown> = {
        format: {
          in: allowedFormats
        },
        AND: [
          whereNotPublicDeveloperCatalog,
          ...(currentAccountId
            ? [{ OR: resourceVisibilityOrForAccount(currentAccountId) }]
            : locals.user?.id
              ? [{ createdBy: locals.user.id }]
              : [{ id: { in: [] as string[] } }])
        ]
      };

      // Use the reusable fetchTableData function with base filtering
      const result = await fetchTableData(locals, url, {
        ...tableOptions,
        baseWhere
      } as any);

      // Filter out already-in-bundle resources
      const filteredRecords = (result.records || []).filter((r: any) => !excludeIds.has(r.id));

      // Adjust meta for filtered-out records and ensure client-friendly pagination shape
      const baseTotal = Number(((result as any)?.meta?.pagination?.total_records) ?? ((result as any)?.meta?.total) ?? 0);
      const perPage = Number(url.searchParams.get('per_page') || (result as any)?.meta?.pagination?.per_page || tableOptions.defaultPerPage);
      const current_page = Number(url.searchParams.get('page') || (result as any)?.meta?.pagination?.page || 1);
      const total = Math.max(0, baseTotal - excludeIds.size);
      const last_page = Math.max(1, Math.ceil(total / perPage));

      return json({
        resources: filteredRecords,
        meta: {
          ...result.meta,
          total,
          last_page,
          pagination: {
            page: current_page,
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
  [SystemRole.USER] // Only allow user role to access this endpoint
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
      
      const bundle = await prisma.bundle.findUnique({
        where: { id: bundleId }
      });
      
      if (!bundle) {
        throw error(404, 'Bundle not found');
      }

      const currentAccountId = (locals as any).currentAccount?.account?.id;
      if (currentAccountId && bundle.accountId !== currentAccountId) {
        throw error(403, 'Access denied');
      }

      const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        include: { sharedWithAccounts: { select: { accountId: true } } }
      });
      
      if (!resource) {
        throw error(404, 'Resource not found');
      }

      try {
        assertResourceRowInstallableByAccount(bundle.accountId, resource as Record<string, unknown>);
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string };
        if (err?.status === 403) throw error(403, err.message || 'Forbidden');
        if (err?.status === 400) throw error(400, err.message || 'Bad request');
        throw e;
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
      
      // Compute next order
      const maxOrder = await (prisma as any).bundleApp.aggregate({
        where: { bundleId },
        _max: { order: true }
      });
      const order = (maxOrder._max?.order ?? 0) + 1;
      
      // Add the resource to the bundle with snapshot fields (used when resource is later deleted)
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
        include: {
          resource: true
        }
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
  [SystemRole.USER] // Only allow user role to access this endpoint
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
      
      // Verify bundle belongs to current account
      const bundle = await prisma.bundle.findUnique({ where: { id: bundleId }, select: { accountId: true } });
      const currentAccountId = (locals as any).currentAccount?.account?.id;
      if (currentAccountId && bundle?.accountId !== currentAccountId) {
        throw error(403, 'Access denied');
      }

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
  [SystemRole.USER] // Only allow user role to access this endpoint
) satisfies RequestHandler;

// Handle unsupported HTTP methods
const fallback: RequestHandler = async ({ request }) => {
  throw error(405, `Method ${request.method} not allowed`);
};

export { fallback as PUT, fallback as HEAD, fallback as OPTIONS };
