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

// Handle POST requests for adding an app to a bundle
export const POST = restrict(
  async ({ request, locals, params }) => {
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
      const existingBundleResource = await prisma.bundleResource.findFirst({
        where: {
          bundleId,
          resourceId
        }
      });
      
      if (existingBundleResource) {
        throw error(400, 'Resource is already in the bundle');
      }
      
      // Add the resource to the bundle
      const bundleResource = await prisma.bundleResource.create({
        data: {
          bundle: { connect: { id: bundleId } },
          resource: { connect: { id: resourceId } },
          autoOpen: data.autoOpen || false
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
            userId: locals.user.id,
            ipAddress: locals.ipAddress,
            prisma: prisma
        })
      
      return json({
        success: true,
        data: bundleResource
      });
    } catch (e) {
      logger.error(`Error adding resource to bundle: ${JSON.stringify(e)}`);
      
      if (e.status) {
        throw error(e.status, e.message);
      }
      
      throw error(500, 'Failed to add resource to bundle');
    }
  },
  [SystemRole.ADMIN] // Only allow admin role to access this endpoint
) satisfies RequestHandler;

// Handle DELETE requests for removing an app from a bundle
export const DELETE = restrict(
  async ({ request, locals, params }) => {
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
      const bundleResource = await prisma.bundleResource.findFirst({
        where: {
          bundleId,
          resourceId
        }
      });
      
      if (!bundleResource) {
        throw error(404, 'Resource not found in bundle');
      }
      
      // Remove the resource from the bundle
      await prisma.bundleResource.delete({
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
            userId: locals.user.id,
            ipAddress: locals.ipAddress,
            prisma: prisma
        })
      
      return json({
        success: true
      });
    } catch (e) {
      logger.error(`Error removing resource from bundle: ${JSON.stringify(e)}`);
      
      if (e.status) {
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