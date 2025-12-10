import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * DELETE /api/v2/bundles/[id]/apps/[appId]
 * Remove an app from a bundle
 * 
 * Verifies:
 * - Bundle app exists
 * - Bundle app belongs to the specified bundle
 */
export const DELETE = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma } = context;
    const { id: bundleId, appId } = params;

    // Check if bundle app exists
    const bundleApp = await prisma.bundleApp.findUnique({
      where: { id: appId }
    });

    if (!bundleApp) {
      throw Object.assign(
        new Error('Bundle app not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Verify that the bundle app belongs to the specified bundle
    if (bundleApp.bundleId !== bundleId) {
      throw Object.assign(
        new Error('Bundle app does not belong to this bundle'),
        { status: 400, code: ErrorCodes.CONFLICT }
      );
    }

    // Delete the bundle app
    await prisma.bundleApp.delete({
      where: { id: appId }
    });

    logger.info(`Removed app from bundle: ${bundleId}, appId: ${appId}`);

    return successResponse(
      { bundleId, appId },
      { message: 'App removed from bundle successfully' }
    );
  },
  { permission: 'bundle.edit' }
);
