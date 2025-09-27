import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { deviceAppProcessor } from '$lib/server/processing/deviceAppProcessor';
import type { RequestHandler } from './$types';

export const POST = restrict(
  async ({ params, locals, auth }: any) => {
    try {
      const { id: deviceId } = params;

      // Check if device exists and user has access
      const device = await locals.prisma.device.findUnique({
        where: { id: deviceId },
        select: {
          id: true,
          name: true,
          accountId: true,
          status: true
        }
      });

      if (!device) {
        return json({
          success: false,
          error: 'Device not found',
          message: 'Device does not exist'
        }, { status: 404 });
      }

      if (device.status !== 'ACTIVE') {
        return json({
          success: false,
          error: 'Device not active',
          message: 'Device is not active and cannot sync'
        }, { status: 400 });
      }

      // Process device app data
      const processor = deviceAppProcessor(locals.prisma);
      const result = await processor.processDeviceApps(deviceId);

      if (!result.success) {
        return json({
          success: false,
          error: 'Sync failed',
          message: result.error || 'Failed to sync device app data'
        }, { status: 500 });
      }

      logger.info(`Successfully synced device ${deviceId}`, {
        deviceId,
        userId: auth.user.id,
        appCount: result.appCount,
        processingTime: result.processingTime
      });

      return json({
        success: true,
        message: 'Device sync completed successfully',
        data: {
          deviceId: result.deviceId,
          accountId: result.accountId,
          appCount: result.appCount,
          processingTime: result.processingTime,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to sync device', {
        error: error instanceof Error ? error.message : String(error),
        deviceId: params.id
      });

      return json({
        success: false,
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN'] // Restrict to admin users
);
