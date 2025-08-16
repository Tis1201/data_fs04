import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = restrict(async ({ params, request, locals, auth }: any) => {
  const deviceId = params.id;
  const { connectionId } = await request.json().catch(() => ({}));

  if (!deviceId || !connectionId) {
    return json({ success: false, error: 'deviceId and connectionId are required' }, { status: 400 });
  }

  // Verify the connection belongs to the current user
  const conn = ConnectionManager.getConnection(connectionId);
  if (!conn) {
    return json({ success: false, error: 'Connection not found' }, { status: 404 });
  }
  const connUserId = conn?.meta?.userInfo?.id;
  if (!connUserId || connUserId !== auth.user.id) {
    return json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Remove the subscription
  await subscriptionRegistry.removeSubscription(
    `subscription:device:${deviceId}`,
    `subscriber:connection:${connectionId}`
  );
  logger.debug(`Unsubscribed user ${auth.user.id} connection ${connectionId} from subscription:device:${deviceId}`);
  return json({ success: true });
}, ['ADMIN', 'USER']);
