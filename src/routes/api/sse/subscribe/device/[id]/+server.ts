import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { logger } from '$lib/server/logger';
import { cleanupStaleSubscriptions } from '$lib/server/messaging/utils/subscriptionCleanup';

export const POST: RequestHandler = restrict(async ({ params, request, locals, auth }: any) => {
  const deviceId = params.id;
  const { connectionId } = await request.json().catch(() => ({}));

  console.log('[SSE Subscribe] ===== NEW SUBSCRIPTION REQUEST =====');
  console.log('[SSE Subscribe] Request received:', { deviceId, connectionId, authUser: auth.user?.id });

  if (!deviceId || !connectionId) {
    console.log('[SSE Subscribe] Missing required fields:', { deviceId, connectionId });
    return json({ success: false, error: 'deviceId and connectionId are required' }, { status: 400 });
  }

  // Verify the connection belongs to the current user
  const conn = ConnectionManager.getConnection(connectionId);
  console.log('[SSE Subscribe] Connection lookup:', { 
    connectionId, 
    found: !!conn, 
    connUserId: conn?.meta?.userInfo?.id,
    authUserId: auth.user?.id,
    connProtocol: conn?.meta?.protocol
  });
  
  if (!conn) {
    console.log('[SSE Subscribe] ERROR: Connection not found in ConnectionManager');
    return json({ success: false, error: 'Connection not found' }, { status: 404 });
  }
  const connUserId = conn?.meta?.userInfo?.id;
  if (!connUserId || connUserId !== auth.user.id) {
    console.log('[SSE Subscribe] ERROR: User mismatch:', { connUserId, authUserId: auth.user?.id });
    return json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Correct order: key = channel (subscription:*), scope = subscriber (subscriber:connection:*)
  const subscriptionKey = `subscription:device:${deviceId}`;
  const subscriberScope = `subscriber:connection:${connectionId}`;
  
  console.log('[SSE Subscribe] Adding subscription:', { subscriptionKey, subscriberScope });
  await subscriptionRegistry.addSubscription(subscriptionKey, subscriberScope);
  
  // Clean up stale subscriptions (connections that no longer exist)
  const cleanedCount = await cleanupStaleSubscriptions(subscriptionKey, connectionId);
  if (cleanedCount > 0) {
    console.log(`[SSE Subscribe] Cleaned up ${cleanedCount} stale subscription(s)`);
  }
  
  // Verify subscription was added and get final count
  const subscribers = await subscriptionRegistry.getByKey(subscriptionKey);
  console.log('[SSE Subscribe] Subscription added successfully. Total subscribers for', subscriptionKey, ':', subscribers.length);
  console.log('[SSE Subscribe] Subscriber list:', subscribers);
  
  logger.info(`[SSE Subscribe] Subscribed user ${auth.user.id} connection ${connectionId} to ${subscriptionKey}`);
  return json({ success: true, subscriberCount: subscribers.length });
}, ['ADMIN', 'USER']);


