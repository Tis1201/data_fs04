import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = restrict(
  async ({ params, locals, auth }: AuthenticatedEvent) => {
    const { id: bundleId } = params as { id: string };
    
    try {
      if (!auth?.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      const actorId = auth.user.id;

      // Get the original bundle with all its relationships
      const originalBundle = await locals.prisma.bundle.findUnique({
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
        return json({ success: false, error: 'Bundle not found' }, { status: 404 });
      }

      // Check the bundle belongs to current account
      const currentAccountId = (locals as any).currentAccount?.account?.id;
      if (currentAccountId && originalBundle.accountId !== currentAccountId) {
        return json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      // Create the new bundle with DRAFT status
      const newBundle = await locals.prisma.bundle.create({
        data: {
          name: `${originalBundle.name} (Copy)`,
          description: originalBundle.description ? `${originalBundle.description} (Copy)` : 'Copy of existing bundle',
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
          createdBy: actorId,
          updatedBy: actorId,
          accountId: originalBundle.accountId
        }
      });

      // Copy all apps from the original bundle (including snapshot fields for deleted resources)
      const appPromises = originalBundle.apps.map((app: any) =>
        locals.prisma.bundleApp.create({
          data: {
            bundleId: newBundle.id,
            resourceId: app.resourceId,
            order: app.order,
            autoOpen: app.autoOpen,
            createdBy: actorId,
            updatedBy: actorId,
            resourceNameSnapshot: app.resourceNameSnapshot ?? app.resource?.name,
            resourcePackageNameSnapshot: app.resourcePackageNameSnapshot ?? app.resource?.packageName,
            resourceVersionSnapshot: app.resourceVersionSnapshot ?? app.resource?.version,
            resourceSizeSnapshot: app.resourceSizeSnapshot ?? app.resource?.size,
            resourceFormatSnapshot: app.resourceFormatSnapshot ?? app.resource?.format
          }
        })
      );

      // Copy all devices from the original bundle in order to preserve device order
      // First, get the original devices sorted by createdAt to maintain order
      const originalDevices = await locals.prisma.bundleDevice.findMany({
        where: { bundleId },
        orderBy: { createdAt: 'asc' }
      });

      // Create devices sequentially with small delays to preserve order
      for (let i = 0; i < originalDevices.length; i++) {
        const bundleDevice = originalDevices[i];
        await locals.prisma.bundleDevice.create({
          data: {
            bundleId: newBundle.id,
            deviceId: bundleDevice.deviceId,
            createdBy: actorId,
            updatedBy: actorId
          }
        });
        
        // Add a small delay (1ms) between each device creation to ensure different timestamps
        if (i < originalDevices.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Execute app copy operations
      await Promise.all(appPromises);

      logger.info(`Bundle ${bundleId} duplicated to ${newBundle.id} by user ${actorId}`);

      return json({
        success: true,
        data: {
          id: newBundle.id,
          name: newBundle.name,
          message: 'Bundle duplicated successfully'
        }
      });

    } catch (error) {
      logger.error(`Failed to duplicate bundle ${bundleId}: ${error instanceof Error ? error.message : String(error)}`);
      return json({ success: false, error: 'Failed to duplicate bundle' }, { status: 500 });
    }
  },
  [SystemRole.USER]
);
