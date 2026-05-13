import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { ActiveDeviceTracker } from '$lib/server/sync/ActiveDeviceTracker';
import { logger } from '$lib/server/logger';

/**
 * API endpoints for marking devices as active/inactive to enable lazy loading.
 */
export const POST: RequestHandler = restrict(
  async (event: AuthenticatedEvent) => {
    const { params, request } = event;
    const { deviceId } = params;

    if (!deviceId) {
      throw error(400, 'Device ID is required');
    }

    const userId = event.auth?.user?.id;
    if (!userId) {
      throw error(401, 'User not authenticated');
    }

    try {
      const body = await request.json().catch(() => ({}));
      const sessionId = body.sessionId || 'default';

      ActiveDeviceTracker.markActive(userId, deviceId, sessionId);

      return json({
        success: true,
        message: 'Device marked as active'
      });
    } catch (err) {
      logger.error('[API] Failed to mark device active', {
        deviceId,
        userId,
        error: err instanceof Error ? err.message : String(err)
      });
      throw error(500, 'Failed to mark device active');
    }
  },
  [SystemRole.ADMIN, SystemRole.USER]
);

export const DELETE: RequestHandler = restrict(
  async (event: AuthenticatedEvent) => {
    const { params, request } = event;
    const { deviceId } = params;

    if (!deviceId) {
      throw error(400, 'Device ID is required');
    }

    const userId = event.auth?.user?.id;
    if (!userId) {
      throw error(401, 'User not authenticated');
    }

    try {
      const body = await request.json().catch(() => ({}));
      const sessionId = body.sessionId || 'default';

      ActiveDeviceTracker.markInactive(userId, deviceId, sessionId);

      return json({
        success: true,
        message: 'Device marked as inactive'
      });
    } catch (err) {
      logger.error('[API] Failed to mark device inactive', {
        deviceId,
        userId,
        error: err instanceof Error ? err.message : String(err)
      });
      throw error(500, 'Failed to mark device inactive');
    }
  },
  [SystemRole.ADMIN, SystemRole.USER]
);
