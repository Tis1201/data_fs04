// src/routes/api/sse/subscribe/admin/devices/+server.ts
// Subscription endpoint for admin users to receive ALL device status updates

import { json, type RequestHandler } from '@sveltejs/kit';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';

/**
 * POST /api/sse/subscribe/admin/devices
 * 
 * Subscribe to receive real-time status updates for ALL devices across all accounts.
 * Only accessible to admin users (SUPER_ADMIN, ADMIN).
 * 
 * This single subscription replaces the need to subscribe to individual devices,
 * making it scalable for viewing large device lists (100k+ devices).
 * 
 * Body: { connectionId: string }
 * Returns: { success: true, channel: "subscription:admin:devices" }
 */
export const POST: RequestHandler = restrict(async ({ request, auth }: any) => {
  try {
    // Get connection ID from request
    const body = await request.json();
    const connectionId = body.connectionId;
    
    if (!connectionId) {
      return json({ success: false, error: 'connectionId is required' }, { status: 400 });
    }
    
    // Verify connection exists and belongs to this user
    const conn = ConnectionManager.getConnection(connectionId);
    if (!conn) {
      return json({ success: false, error: 'Connection not found' }, { status: 404 });
    }
    
    if (conn.meta.userInfo.id !== auth.user.id) {
      return json({ success: false, error: 'Connection does not belong to user' }, { status: 403 });
    }
    
    // Subscribe to admin devices channel
    const subscriptionKey = 'subscription:admin:devices';
    const subscriberScope = `subscriber:connection:${connectionId}`;
    
    await subscriptionRegistry.addSubscription(subscriptionKey, subscriberScope);
    
    logger.info(`[SSE] Admin ${auth.user.email} subscribed to all devices (connection: ${connectionId})`);
    
    return json({ 
      success: true, 
      channel: subscriptionKey,
      message: 'Subscribed to all device updates'
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[SSE] Admin devices subscription error:', { error: errorMessage });
    return json({ 
      success: false, 
      error: errorMessage
    }, { status: 500 });
  }
}, ['SUPER_ADMIN', 'ADMIN']); // Only allow admin users

