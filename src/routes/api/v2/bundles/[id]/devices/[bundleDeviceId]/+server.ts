import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * DELETE /api/v2/bundles/[id]/devices/[bundleDeviceId]
 * Remove a device from a bundle
 * 
 * Verifies:
 * - Bundle device exists
 * - Bundle device belongs to the specified bundle
 */
export const DELETE = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId, bundleDeviceId } = params;

    // Find the bundleDevice
    const existing = await prisma.bundleDevice.findUnique({
      where: { id: bundleDeviceId },
      select: { id: true, bundleId: true, deviceId: true }
    });

    if (!existing || existing.bundleId !== bundleId) {
      throw Object.assign(
        new Error('Device not found in bundle'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Delete
    await prisma.bundleDevice.delete({ where: { id: bundleDeviceId } });

    logger.info(
      `BundleDevice ${bundleDeviceId} removed from bundle ${bundleId} by user ${session.user.id}`
    );

    return successResponse(
      { bundleId, bundleDeviceId },
      { message: 'Device removed from bundle' }
    );
  },
  { permission: 'bundle.edit' }
);
