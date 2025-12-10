import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/bundles/[id]/devices
 * Add a device to a bundle
 * 
 * Body:
 * - deviceId: string (required) - Device ID to add
 * - status: string (optional, default: 'PENDING') - Initial status
 * 
 * Restrictions:
 * - Bundle must be in DRAFT status
 * - Device must exist
 * - Device cannot already be in the bundle
 */
export const POST = unifiedEndpoint(
  async ({ context, params, event }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;
    const { deviceId, status = 'PENDING' } = await event.request.json();

    // Validate input
    if (!deviceId) {
      throw Object.assign(
        new Error('Device ID is required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

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

    // Check if device is already in bundle
    const existingBundleDevice = await prisma.bundleDevice.findUnique({
      where: {
        bundleId_deviceId: {
          bundleId,
          deviceId
        }
      }
    });

    if (existingBundleDevice) {
      throw Object.assign(
        new Error('Device is already in this bundle'),
        { status: 409, code: ErrorCodes.CONFLICT }
      );
    }

    // Add device to bundle
    const bundleDevice = await prisma.bundleDevice.create({
      data: {
        bundleId,
        deviceId,
        status,
        createdBy: session.user.id,
        updatedBy: session.user.id
      },
      select: {
        id: true,
        bundleId: true,
        deviceId: true,
        status: true,
        createdAt: true
      }
    });

    logger.info(`Device ${deviceId} added to bundle ${bundleId} by user ${session.user.id}`);

    return successResponse(
      { bundleDevice },
      { message: 'Device added to bundle successfully' }
    );
  },
  { permission: 'bundle.edit' }
);
