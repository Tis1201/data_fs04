import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { publishBundleCore } from '$lib/server/bundles/bundlePublisher';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/bundles/[id]/publish
 * Publish a bundle (move from DRAFT to PUBLISHED)
 * 
 * This endpoint:
 * - Changes bundle status to PUBLISHED
 * - Creates waves based on waveSize
 * - Auto-starts first wave
 * - Sends MQTT commands to devices in first wave
 * - Sets up timeout tracking
 * - Initializes state management
 * 
 * Restrictions:
 * - Only DRAFT bundles can be published
 * 
 * Note: This delegates to publishBundleCore which handles
 * all the complex wave management, device messaging via MQTT, and state tracking
 */
export const POST = unifiedEndpoint(
  async ({ context, event, params }) => {
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

    // Delegate to core publish logic
    // This will:
    // 1. Create waves
    // 2. Assign devices to waves
    // 3. Start first wave
    // 4. Send MQTT notifications to devices
    // 5. Set up timeout tracking
    logger.info(`[BundlePublish] Publishing bundle ${bundleId} by user ${session.user.id}`);
    const result = await publishBundleCore(prisma, bundleId, session.user.id);

    // Log audit for bundle publish (status change from DRAFT to PUBLISHED)
    if (result.status === 200 || result.status === 201) {
      const updatedBundle = await prisma.bundle.findUnique({
        where: { id: bundleId }
      });
      
      if (updatedBundle) {
        await logAudit({
          actionType: AuditActionType.UPDATE,
          tableName: 'Bundle',
          recordId: bundleId,
          oldData: bundle,
          newData: updatedBundle,
          userId: session.user.id,
          ipAddress: event.getClientAddress?.() || 'unknown',
          prisma
        });
      }
    }

    // Extract wavesCreated from result
    const wavesCreated = result?.body?.wavesCreated ?? 0;

    return successResponse(
      { 
        bundleId, 
        status: 'PUBLISHED',
        wavesCreated,
        bundle: result?.body?.bundle
      },
      {
        message: wavesCreated > 0 
          ? `Bundle published successfully with ${wavesCreated} wave(s). First wave started automatically.`
          : 'Bundle published successfully.'
      }
    );
  },
  { permission: 'bundle.publish' }
);
