import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import type { RequestHandler } from './$types';

export const POST = restrict(
  async ({ request, locals, auth }: any) => {
    try {
      const body = await request.json();
      const { deviceId, type, data } = body;

      if (!deviceId || !type || !data) {
        return json({
          success: false,
          error: 'Missing required fields',
          message: 'deviceId, type, and data are required'
        }, { status: 400 });
      }

      // Validate action type
      if (type === 'device_action') {
        const { action, package_name } = data;
        if (!action || !package_name) {
          return json({
            success: false,
            error: 'Invalid device action data',
            message: 'action and package_name are required for device_action type'
          }, { status: 400 });
        }

        // Validate action type
        const validActions = ['uninstall', 'restart', 'config'];
        if (!validActions.includes(action)) {
          return json({
            success: false,
            error: 'Invalid action',
            message: `Action must be one of: ${validActions.join(', ')}`
          }, { status: 400 });
        }
      }

      // Find the device's SSE connection
      const deviceConnection = await ConnectionManager.getConnectionByDeviceId(deviceId);

      if (!deviceConnection) {
        logger.warn(`[SSE Send API] No active SSE connection found for device: ${deviceId}`, {
          deviceId,
          userId: auth.user.id
        });
        
        // List all available connections for debugging
        ConnectionManager.listAllConnections();
        
        return json({
          success: false,
          error: 'Device not connected',
          message: 'No active SSE connection found for this device. Make sure the device is connected via /api/device/listen endpoint.',
          debug: {
            deviceId,
            totalConnections: ConnectionManager.getConnectionCount()
          }
        }, { status: 404 });
      }

      // Send the message to the device
      try {
        await deviceConnection.send({
          type,
          data,
          timestamp: new Date().toISOString(),
          from: 'server'
        });

        logger.info(`[SSE Send API] Message sent to device ${deviceId}`, {
          deviceId,
          type,
          data,
          userId: auth.user.id,
          connectionId: deviceConnection.meta.id
        });

        return json({
          success: true,
          message: 'Message sent to device successfully',
          data: {
            deviceId,
            type,
            data,
            timestamp: new Date().toISOString()
          }
        });
      } catch (sendError) {
        logger.error(`[SSE Send API] Failed to send message to device ${deviceId}`, {
          deviceId,
          type,
          data,
          userId: auth.user.id,
          error: sendError instanceof Error ? sendError.message : String(sendError)
        });

        return json({
          success: false,
          error: 'Failed to send message',
          message: 'Message could not be delivered to the device'
        }, { status: 500 });
      }

    } catch (error) {
      logger.error('Failed to send SSE message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      return json({
        success: false,
        error: 'Failed to send SSE message',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  },
  ['ADMIN'] // Restrict to admin users
);
