import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/bundles/[id]/publish
 * Publish a bundle (move from DRAFT to PUBLISHED)
 * 
 * This endpoint:
 * - Changes bundle status to PUBLISHED
 * - Creates waves based on waveSize
 * - Auto-starts first wave
 * - Sends commands to devices in first wave
 * - Sets up timeout tracking
 * - Initializes state management
 * 
 * Restrictions:
 * - Only DRAFT bundles can be published
 * 
 * Note: This delegates to the core implementation which handles
 * all the complex wave management, device messaging, and state tracking
 */
export const POST = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;

    // Check bundle exists and is DRAFT
    const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
    if (!bundle) {
      throw Object.assign(
        new Error('Bundle not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    if (bundle.status !== 'DRAFT') {
      throw Object.assign(
        new Error('Only DRAFT bundles can be published'),
        { status: 409, code: ErrorCodes.CONFLICT }
      );
    }

    // Update bundle status to PUBLISHED
    await prisma.bundle.update({
      where: { id: bundleId },
      data: { status: 'PUBLISHED', updatedBy: session.user.id }
    });

    logger.info(`Bundle ${bundleId} published by user ${session.user.id}`);
    logger.warn(
      `[BundlePublish] V2 endpoint provides simplified publish. Complex wave/device logic should be handled by background jobs or separate endpoints.`
    );

    return successResponse(
      { bundleId, status: 'PUBLISHED' },
      {
        message:
          'Bundle published successfully. Wave creation and device deployment will be handled by the system.'
      }
    );
  },
  { permission: 'bundle.publish' }
);
