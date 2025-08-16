import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = restrict(async ({ auth }) => {
  try {
    const results = {
      connections: {
        before: ConnectionManager.getLiveConnectionCount(),
        after: 0,
        removed: 0
      },
      subscriptions: {
        before: 0,
        after: 0,
        removed: 0
      }
    };
    
    // Get current subscriptions count
    const allSubscriptions = await subscriptionRegistry.getAll();
    results.subscriptions.before = allSubscriptions.length;
    
    // Get all connections
    const allConnections = await ConnectionManager.getAllConnectionMetas();
    
    // Find stale connections (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const staleConnections = allConnections.filter(conn => {
      const createdAt = new Date(conn.createdAt || 0);
      return createdAt < oneHourAgo;
    });
    
    // Remove stale connections
    for (const conn of staleConnections) {
      try {
        ConnectionManager.unregisterConnection(conn.id);
        results.connections.removed++;
      } catch (error) {
        logger.warn(`[Cleanup] Failed to remove stale connection ${conn.id}: ${error}`);
      }
    }
    
    // Remove subscriptions for stale connections
    const staleConnectionIds = new Set(staleConnections.map(conn => conn.id));
    const staleSubscriptions = allSubscriptions.filter(sub => {
      const connectionId = sub.scope.replace('subscriber:connection:', '');
      return staleConnectionIds.has(connectionId);
    });
    
    for (const sub of staleSubscriptions) {
      try {
        await subscriptionRegistry.removeSubscription(sub.key, sub.scope);
        results.subscriptions.removed++;
      } catch (error) {
        logger.warn(`[Cleanup] Failed to remove stale subscription ${sub.id}: ${error}`);
      }
    }
    
    // Get final counts
    results.connections.after = ConnectionManager.getLiveConnectionCount();
    const finalSubscriptions = await subscriptionRegistry.getAll();
    results.subscriptions.after = finalSubscriptions.length;
    
    logger.info(`[Cleanup] Removed ${results.connections.removed} stale connections and ${results.subscriptions.removed} stale subscriptions`);
    
    return json({
      success: true,
      message: `Cleaned up ${results.connections.removed} connections and ${results.subscriptions.removed} subscriptions`,
      results
    });
  } catch (error) {
    logger.error(`[Cleanup] Error during cleanup: ${error}`);
    return json({ error: 'Failed to cleanup connections' }, { status: 500 });
  }
}, [SystemRole.ADMIN, SystemRole.SUPER_ADMIN]);
