import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = restrict(async ({ params, request, locals, auth }: any) => {
  const profileId = params.id;
  const { connectionId } = await request.json().catch(() => ({}));

  console.log('[SSE Subscribe] Request received:', { profileId, connectionId, authUser: auth.user?.id });

  if (!profileId || !connectionId) {
    return json({ success: false, error: 'profileId and connectionId are required' }, { status: 400 });
  }

  // Verify the connection belongs to the current user
  const conn = ConnectionManager.getConnection(connectionId);
  console.log('[SSE Subscribe] Connection found:', { 
    connectionId, 
    conn: !!conn, 
    connUserId: conn?.meta?.userInfo?.id,
    authUserId: auth.user?.id 
  });
  
  if (!conn) {
    return json({ success: false, error: 'Connection not found' }, { status: 404 });
  }
  const connUserId = conn?.meta?.userInfo?.id;
  if (!connUserId || connUserId !== auth.user.id) {
    console.log('[SSE Subscribe] User mismatch:', { connUserId, authUserId: auth.user?.id });
    return json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  // Correct order: key = channel (subscription:*), scope = subscriber (subscriber:connection:*)
  const assignments = await locals.prisma.deviceProfileAssignment.findMany({
    where: { profileId },
    select: {
        deviceId: true
    }
  });

  await Promise.all(assignments.map(async (assignment: { deviceId: string }) => {
    await subscriptionRegistry.addSubscription(
      `subscription:device:${assignment.deviceId}`,
      `subscriber:connection:${connectionId}`
    );
    logger.debug(`Subscribed user ${auth.user.id} connection ${connectionId} to subscription:device:${assignment.deviceId}`);
  }));
  
  return json({ success: true });
}, ['ADMIN', 'USER']);


