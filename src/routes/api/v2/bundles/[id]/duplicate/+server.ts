import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/bundles/[id]/duplicate
 * Duplicate a bundle
 * 
 * Creates a copy of the bundle with:
 * - New name with " (Copy)" suffix
 * - DRAFT status
 * - All apps copied
 * - All devices copied (preserving order)
 * - Reset scheduling
 */
export const POST = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;

    // Get the original bundle with all its relationships
    const originalBundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      include: {
        apps: {
          include: {
            resource: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        devices: true
      }
    });

    if (!originalBundle) {
      throw Object.assign(
        new Error('Bundle not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Create the new bundle with DRAFT status
    const newBundle = await prisma.bundle.create({
      data: {
        name: `${originalBundle.name} (Copy)`,
        description: originalBundle.description
          ? `${originalBundle.description} (Copy)`
          : 'Copy of existing bundle',
        os: originalBundle.os,
        reboot: originalBundle.reboot,
        autoOpen: originalBundle.autoOpen,
        forceUpdate: originalBundle.forceUpdate,
        status: 'DRAFT',
        version: originalBundle.version,
        waveSize: originalBundle.waveSize,
        scheduledAt: null, // Reset scheduling
        scheduledAtTimezone: null,
        scheduledAtStartIfMissed: false,
        createdBy: session.user.id,
        updatedBy: session.user.id,
        accountId: originalBundle.accountId
      }
    });

    // Copy all apps from the original bundle (including snapshot fields for deleted resources)
    const appPromises = originalBundle.apps.map((app: any) =>
      prisma.bundleApp.create({
        data: {
          bundleId: newBundle.id,
          resourceId: app.resourceId,
          order: app.order,
          autoOpen: app.autoOpen,
          createdBy: session.user.id,
          updatedBy: session.user.id,
          resourceNameSnapshot: app.resourceNameSnapshot ?? app.resource?.name,
          resourcePackageNameSnapshot: app.resourcePackageNameSnapshot ?? app.resource?.packageName,
          resourceVersionSnapshot: app.resourceVersionSnapshot ?? app.resource?.version,
          resourceSizeSnapshot: app.resourceSizeSnapshot ?? app.resource?.size,
          resourceFormatSnapshot: app.resourceFormatSnapshot ?? app.resource?.format
        }
      })
    );

    // Copy all devices from the original bundle in order to preserve device order
    const originalDevices = await prisma.bundleDevice.findMany({
      where: { bundleId },
      orderBy: { createdAt: 'asc' }
    });

    // Create devices sequentially with small delays to preserve order
    for (let i = 0; i < originalDevices.length; i++) {
      const bundleDevice = originalDevices[i];
      await prisma.bundleDevice.create({
        data: {
          bundleId: newBundle.id,
          deviceId: bundleDevice.deviceId,
          createdBy: session.user.id,
          updatedBy: session.user.id
        }
      });

      // Add a small delay (1ms) between each device creation to ensure different timestamps
      if (i < originalDevices.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
    }

    // Execute app copy operations
    await Promise.all(appPromises);

    logger.info(`Bundle ${bundleId} duplicated to ${newBundle.id} by user ${session.user.id}`);

    return successResponse(
      {
        id: newBundle.id,
        name: newBundle.name,
        message: `Bundle duplicated successfully. New bundle ID: ${newBundle.id}`
      },
      { message: 'Bundle duplicated successfully', status: 201 }
    );
  },
  { permission: 'bundle.create' }
);
