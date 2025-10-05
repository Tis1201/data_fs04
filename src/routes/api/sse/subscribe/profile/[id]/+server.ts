import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: profileId } = params;
    const { connectionId } = await request.json();

    if (!connectionId) {
      return json({ error: 'Connection ID is required' }, { status: 400 });
    }

    // Verify the connection exists
    const connection = ConnectionManager.getConnection(connectionId);
    if (!connection) {
      return json({ error: 'Connection not found' }, { status: 404 });
    }

    // Add subscription for profile-specific messages
    const profileSubscriptionKey = `subscription:profile:${profileId}`;
    const connectionScope = `subscriber:connection:${connectionId}`;

    await subscriptionRegistry.addSubscription(profileSubscriptionKey, connectionScope);
    
    logger.info(`User ${auth.user.id} subscribed to profile ${profileId}`, {
      profileId,
      connectionId,
      subscriptionKey: profileSubscriptionKey,
      connectionScope
    });

    return json({
      success: true,
      message: `Subscribed to profile ${profileId}`,
      subscriptionKey: profileSubscriptionKey
    });

  } catch (error) {
    logger.error(`Error subscribing to profile: ${String(error)}`);
    return json({ error: 'Failed to subscribe to profile' }, { status: 500 });
  }
};
