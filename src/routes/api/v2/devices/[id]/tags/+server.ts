import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/devices/[id]/tags
 * Add a tag to a device
 * 
 * Body:
 * - deviceTagId: string (required) - Tag ID to add
 * 
 * Validates:
 * - Device exists
 * - Tag not already on device
 */
export const POST = unifiedEndpoint(
  async ({ context, params, event }) => {
    const { prisma, session } = context;
    const { id: deviceId } = params;
    const { deviceTagId } = await event.request.json();

    // Validate input
    if (!deviceTagId) {
      throw Object.assign(
        new Error('Device Tag ID is required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Check if device exists
    const device = await prisma.device.findUnique({
      where: { id: deviceId }
    });

    if (!device) {
      throw Object.assign(
        new Error('Device not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Check if tag is already on device
    const existingDeviceDeviceTag = await prisma.device.findFirst({
      where: {
        id: deviceId,
        tags: {
          some: { id: deviceTagId }
        }
      }
    });

    if (existingDeviceDeviceTag) {
      throw Object.assign(
        new Error('Device tag is already on this device'),
        { status: 409, code: ErrorCodes.CONFLICT }
      );
    }

    // Add device tag to device
    const updatedDevice = await prisma.device.update({
      where: { id: deviceId },
      data: {
        tags: {
          connect: { id: deviceTagId }
        }
      },
      select: {
        id: true,
        tags: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    logger.info(
      `Device tag ${deviceTagId} added to device ${deviceId} by user ${session.user.id}`
    );

    return successResponse(
      { device: updatedDevice },
      { message: 'Device tag added successfully' }
    );
  },
  { permission: 'device.edit', skipPermission: true }
);
