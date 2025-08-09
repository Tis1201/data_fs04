import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deviceSimulator } from '$lib/server/device/deviceSimulator';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const devices = deviceSimulator.getSimulatedDevices();
    const stats = deviceSimulator.getDeviceStatistics();

    return json({
      success: true,
      devices,
      stats
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, deviceType } = body;

    if (!name) {
      return json({ error: 'Device name is required' }, { status: 400 });
    }

    // Create a new simulated device
    const deviceId = `device-sim-${Date.now()}`;
    const newDevice = {
      id: deviceId,
      name,
      status: 'ONLINE' as const,
      connected: true,
      lastSeen: new Date(),
      firmwareVersion: '2.1.0',
      osVersion: 'Android 11',
      installedApps: [],
      bundleInstallSessions: []
    };

    deviceSimulator.addSimulatedDevice(newDevice);

    return json({
      success: true,
      device: newDevice,
      message: 'Simulated device added successfully'
    });

  } catch (error) {
    return errorHandler(error);
  }
};
