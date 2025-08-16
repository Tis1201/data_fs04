import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/auth/restrict';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = restrict(
  async ({ params, locals, auth }) => {
    const { id: bundleId } = params as { id: string };
    
    try {
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

      // Check if user has access to this bundle
      if (originalBundle.createdBy !== auth.user.id) {
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
          createdBy: auth.user.id,
          updatedBy: auth.user.id,
          accountId: originalBundle.accountId
        }
      });

      // Copy all apps from the original bundle
      const appPromises = originalBundle.apps.map((app) =>
        locals.prisma.bundleApp.create({
          data: {
            bundleId: newBundle.id,
            resourceId: app.resourceId,
            order: app.order,
            autoOpen: app.autoOpen,
            createdBy: auth.user.id,
            updatedBy: auth.user.id
          }
        })
      );

      // Copy all devices from the original bundle
      const devicePromises = originalBundle.devices.map((bundleDevice) =>
        locals.prisma.bundleDevice.create({
          data: {
            bundleId: newBundle.id,
            deviceId: bundleDevice.deviceId,
            createdBy: auth.user.id,
            updatedBy: auth.user.id
          }
        })
      );

      // Execute all the copy operations
      await Promise.all([...appPromises, ...devicePromises]);

      logger.info(`Bundle ${bundleId} duplicated to ${newBundle.id} by user ${auth.user.id}`);

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
