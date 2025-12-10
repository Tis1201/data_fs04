import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * DELETE /api/v2/devices/[id]/tags/[tagId]
 * Remove a tag from a device
 * 
 * Disconnects the tag from the device (many-to-many relationship)
 */
export const DELETE = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: deviceId, tagId } = params;

    // Remove device tag from device
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        tags: {
          disconnect: { id: tagId }
        }
      }
    });

    logger.info(
      `Device tag ${tagId} removed from device ${deviceId} by user ${session.user.id}`
    );

    return successResponse(
      { deviceId, tagId },
      { message: 'Device tag removed from device' }
    );
  },
  { permission: 'device.edit' }
);
