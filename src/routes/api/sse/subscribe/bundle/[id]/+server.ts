import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { logger } from '$lib/server/logger';

// Subscribe a web SSE connection to a bundle channel so it can receive bundle:status events
export const POST: RequestHandler = restrict(async ({ params, request, auth }: any) => {
  const bundleId = params.id;
  const { connectionId } = await request.json().catch(() => ({}));

  if (!bundleId || !connectionId) {
    return json({ success: false, error: 'bundleId and connectionId are required' }, { status: 400 });
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

  // Correct order: key = channel (subscription:*), scope = subscriber (subscriber:connection:*)
  await subscriptionRegistry.addSubscription(
    `subscription:bundle:${bundleId}`,
    `subscriber:connection:${connectionId}`
  );
  logger.debug(`Subscribed user ${auth.user.id} connection ${connectionId} to subscription:bundle:${bundleId}`);
  return json({ success: true });
});


