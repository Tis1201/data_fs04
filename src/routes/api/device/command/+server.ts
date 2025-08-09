import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deviceCommandProcessor, type DeviceCommand } from '$lib/server/device/deviceCommandProcessor';
import { deviceService } from '$lib/server/device/deviceService';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, headers }) => {
  try {
    // Authenticate device via API key
    const apiKey = headers.get('x-api-key');
    if (!apiKey) {
      return json({ error: 'API key required' }, { status: 401 });
    }

    const device = await deviceService.getDeviceByApiKey(apiKey);
    if (!device) {
      return json({ error: 'Invalid API key' }, { status: 401 });
    }

    const body = await request.json();
    const { type, payload } = body;

    if (!type) {
      return json({ error: 'Command type is required' }, { status: 400 });
    }

    // Create command object
    const command: DeviceCommand = {
      type,
      deviceId: device.id,
      payload: payload || {}
    };

    logger.info(`Device ${device.id} requesting command`, {
      commandType: type,
      deviceId: device.id
    });

    // Process the command
    const result = await deviceCommandProcessor.processCommand(command);

    if (result.success) {
      logger.info(`Command processed successfully`, {
        deviceId: device.id,
        commandType: type
      });
    } else {
      logger.warn(`Command processing failed`, {
        deviceId: device.id,
        commandType: type,
        error: result.error
      });
    }

    return json(result);

  } catch (error) {
    logger.error('Error processing device command', { error });
    return json({ 
      success: false, 
      message: 'Internal server error',
      error: 'Command processing failed'
    }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ headers }) => {
  try {
    // Authenticate device via API key
    const apiKey = headers.get('x-api-key');
    if (!apiKey) {
      return json({ error: 'API key required' }, { status: 401 });
    }

    const device = await deviceService.getDeviceByApiKey(apiKey);
    if (!device) {
      return json({ error: 'Invalid API key' }, { status: 401 });
    }

    // Return supported commands for this device
    const supportedCommands = deviceCommandProcessor.getSupportedCommands();

    return json({
      success: true,
      deviceId: device.id,
      supportedCommands,
      message: 'Device command endpoint ready'
    });

  } catch (error) {
    logger.error('Error getting device command info', { error });
    return json({ 
      success: false, 
      message: 'Internal server error',
      error: 'Failed to get command info'
    }, { status: 500 });
  }
};
