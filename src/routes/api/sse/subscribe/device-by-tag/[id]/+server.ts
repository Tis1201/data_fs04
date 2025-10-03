import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = restrict(async ({ params, request, locals, auth }: any) => {
  const tagId = params.id;
  const { connectionId } = await request.json().catch(() => ({}));

  console.log('[SSE Subscribe] Request received:', { tagId, connectionId, authUser: auth.user?.id });

  if (!tagId || !connectionId) {
    return json({ success: false, error: 'tagId and connectionId are required' }, { status: 400 });
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

  const devices = await locals.prisma.device.findMany({
    where: {
      tags: {
        some: {
          id: tagId
        }
      },
      profileAssignment: null // Only get devices that are not already assigned
    },
    select: {
      id: true
    }
  });

  await Promise.all(devices.map(async device => {
    await subscriptionRegistry.addSubscription(
      `subscription:device:${device.id}`,
      `subscriber:connection:${connectionId}`
    );
    logger.debug(`Subscribed user ${auth.user.id} connection ${connectionId} to subscription:device:${device.id}`);
  }));

  return json({ success: true });
}, ['ADMIN', 'USER']);


