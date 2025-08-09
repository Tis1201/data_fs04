import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bundleInstallService } from '$lib/server/bundle-install/bundleInstallService';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return json({ error: 'Session ID is required' }, { status: 400 });
    }

    const session = await bundleInstallService.getSessionStatus(sessionId);
    if (!session) {
      return json({ error: 'Session not found' }, { status: 404 });
    }

    return json({
      success: true,
      session
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return json({ error: 'Session ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        await bundleInstallService.startSession(sessionId);
        return json({
          success: true,
          message: 'Session started successfully'
        });

      case 'cancel':
        await bundleInstallService.cancelSession(sessionId);
        return json({
          success: true,
          message: 'Session cancelled successfully'
        });

      case 'retry':
        const { deviceIds } = body;
        if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
          return json({ error: 'Device IDs are required for retry' }, { status: 400 });
        }
        await bundleInstallService.retryFailedDevices(sessionId, deviceIds);
        return json({
          success: true,
          message: `Retrying ${deviceIds.length} failed devices`
        });

      default:
        return json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    return errorHandler(error);
  }
};
