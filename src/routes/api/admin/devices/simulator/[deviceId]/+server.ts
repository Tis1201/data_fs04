import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deviceSimulator } from '$lib/server/device/deviceSimulator';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deviceId } = params;
    if (!deviceId) {
      return json({ error: 'Device ID is required' }, { status: 400 });
    }

    const removed = deviceSimulator.removeSimulatedDevice(deviceId);
    
    if (removed) {
      return json({
        success: true,
        message: 'Simulated device removed successfully'
      });
    } else {
      return json({ error: 'Device not found' }, { status: 404 });
    }

  } catch (error) {
    return errorHandler(error);
  }
};
