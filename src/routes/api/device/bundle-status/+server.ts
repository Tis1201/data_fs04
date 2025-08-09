import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bundleInstallService } from '$lib/server/bundle-install/bundleInstallService';
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
    const {
      sessionId,
      batchId,
      bundleId,
      status,
      progress,
      message,
      error
    } = body;

    // Validate required fields
    if (!sessionId || !batchId || !bundleId || !status) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate status values
    const validStatuses = ['PENDING', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return json({ error: 'Invalid status value' }, { status: 400 });
    }

    // Validate progress range
    if (progress !== undefined && (progress < 0 || progress > 100)) {
      return json({ error: 'Progress must be between 0 and 100' }, { status: 400 });
    }

    // Update the status
    await bundleInstallService.updateDeviceStatus(
      sessionId,
      batchId,
      device.id,
      bundleId,
      status,
      progress || 0,
      message,
      error
    );

    logger.info(`Device ${device.id} reported bundle status`, {
      sessionId,
      batchId,
      bundleId,
      status,
      progress,
      deviceId: device.id
    });

    return json({
      success: true,
      message: 'Status updated successfully'
    });

  } catch (error) {
    logger.error('Error updating bundle status', { error });
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
