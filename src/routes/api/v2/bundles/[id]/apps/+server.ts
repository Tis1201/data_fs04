import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { assertResourceRowInstallableByAccount } from '$lib/server/resources/resourceInstallAccess';

// Schema for adding an app to a bundle
const addBundleAppSchema = z.object({
  resourceId: z.string().min(1, 'Resource ID is required'),
  order: z.number().int().positive('Order must be a positive integer'),
  autoOpen: z.boolean().default(false)
});

/**
 * POST /api/v2/bundles/[id]/apps
 * Add an app (resource) to a bundle
 * 
 * Body:
 * - resourceId: string (required) - Resource ID to add
 * - order: number (required) - Display order (positive integer)
 * - autoOpen: boolean (optional, default: false) - Auto-open on device
 * 
 * Restrictions:
 * - Bundle must be in DRAFT status
 * - Resource must exist
 * - App cannot already be in the bundle
 */
export const POST = unifiedEndpoint(
  async ({ context, params, event }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;

    // Parse and validate the request body
    const body = await event.request.json();
    const result = addBundleAppSchema.safeParse(body);

    if (!result.success) {
      throw Object.assign(
        new Error('Invalid request data'),
        { status: 400, code: ErrorCodes.INVALID_INPUT, details: result.error.format() }
      );
    }

    const { resourceId, order, autoOpen } = result.data;

    // Check if bundle exists
    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId }
    });

    if (!bundle) {
      throw Object.assign(
        new Error('Bundle not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Enforce DRAFT-only modifications
    if (bundle.status !== 'DRAFT') {
      throw Object.assign(
        new Error('Bundle is not editable (must be DRAFT)'),
        { status: 403, code: ErrorCodes.FORBIDDEN }
      );
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: { sharedWithAccounts: { select: { accountId: true } } }
    });

    if (!resource) {
      throw Object.assign(
        new Error('Resource not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    assertResourceRowInstallableByAccount(bundle.accountId, resource as Record<string, unknown>);

    // Check if the app is already in the bundle
    const existingApp = await prisma.bundleApp.findFirst({
      where: {
        bundleId,
        resourceId
      }
    });

    if (existingApp) {
      throw Object.assign(
        new Error('App already added to this bundle'),
        { status: 409, code: ErrorCodes.CONFLICT }
      );
    }

    // Create the bundle app with snapshot fields (used when resource is later deleted)
    const bundleApp = await prisma.bundleApp.create({
      data: {
        bundleId,
        resourceId,
        order,
        autoOpen,
        createdBy: session.user.id,
        updatedBy: session.user.id,
        resourceNameSnapshot: resource.name,
        resourcePackageNameSnapshot: resource.packageName,
        resourceVersionSnapshot: resource.version,
        resourceSizeSnapshot: resource.size,
        resourceFormatSnapshot: resource.format
      }
    });

    logger.info(`Added app to bundle: ${bundleId}, resourceId: ${resourceId}`);

    // Log audit for bundle app creation
    await logAudit({
      actionType: AuditActionType.INSERT,
      tableName: 'BundleApp',
      recordId: bundleApp.id,
      oldData: null,
      newData: bundleApp,
      userId: session.user.id,
      ipAddress: event.getClientAddress?.() || 'unknown',
      prisma
    });

    return successResponse(
      { bundleApp },
      { message: 'App added to bundle successfully' }
    );
  },
  { permission: 'bundle.edit' }
);
