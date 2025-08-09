import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deviceSimulator } from '$lib/server/device/deviceSimulator';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deviceId } = params;
    if (!deviceId) {
      return json({ error: 'Device ID is required' }, { status: 400 });
    }

    deviceSimulator.simulateDeviceRecovery(deviceId);

    return json({
      success: true,
      message: 'Device recovery simulated successfully'
    });

  } catch (error) {
    return errorHandler(error);
  }
};
