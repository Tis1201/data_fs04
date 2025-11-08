// src/routes/api/sse/subscribe/account/[accountId]/devices/+server.ts
// Subscription endpoint for account members to receive device status updates for their account

import { json, type RequestHandler } from '@sveltejs/kit';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { getAdminPrisma } from '$lib/server/prisma';

/**
 * POST /api/sse/subscribe/account/:accountId/devices
 * 
 * Subscribe to receive real-time status updates for all devices in a specific account.
 * Only accessible to users who are members of the account or admin users.
 * 
 * This single subscription replaces the need to subscribe to individual devices,
 * making it scalable for viewing large device lists within an account.
 * 
 * Body: { connectionId: string }
 * Returns: { success: true, channel: "subscription:account:{accountId}:devices" }
 */
export const POST: RequestHandler = restrict(async ({ request, params, auth }: any) => {
  try {
    const accountId = params.accountId;
    
    if (!accountId) {
      return json({ success: false, error: 'accountId is required' }, { status: 400 });
    }
    
    // Check if user has access to this account
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(auth.user.systemRole);
    
    if (!isAdmin) {
      // Regular user: verify they are a member of this account
      const prisma = getAdminPrisma();
      const membership = await prisma.accountMembership.findFirst({
        where: {
          accountId,
          userId: auth.user.id,
          status: 'ACTIVE'
        }
      });
      
      if (!membership) {
        return json({ 
          success: false, 
          error: 'You are not a member of this account' 
        }, { status: 403 });
      }
    }
    
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
    
    // Subscribe to account devices channel
    const subscriptionKey = `subscription:account:${accountId}:devices`;
    const subscriberScope = `subscriber:connection:${connectionId}`;
    
    await subscriptionRegistry.addSubscription(subscriptionKey, subscriberScope);
    
    logger.info(`[SSE] User ${auth.user.email} subscribed to account ${accountId} devices (connection: ${connectionId})`);
    
    return json({ 
      success: true, 
      channel: subscriptionKey,
      accountId,
      message: 'Subscribed to account device updates'
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[SSE] Account devices subscription error:', { error: errorMessage });
    return json({ 
      success: false, 
      error: errorMessage
    }, { status: 500 });
  }
}, ['SUPER_ADMIN', 'ADMIN', 'USER']); // Allow all authenticated users (membership checked inside)

