import { subscriptionRegistry } from '../core/subscriptionRegistry';
import { ConnectionManager } from '../core/connectionManager';
import { logger } from '$lib/server/logger';

/**
 * Clean up stale subscriptions for a given subscription key.
 * Removes subscriptions where the connection no longer exists.
 * 
 * @param subscriptionKey - The subscription key to clean (e.g., "subscription:device:123")
 * @param currentConnectionId - The current connection ID to exclude from cleanup
 * @returns Number of stale subscriptions cleaned up
 */
export async function cleanupStaleSubscriptions(
    subscriptionKey: string,
    currentConnectionId?: string
): Promise<number> {
    const allSubscribers = await subscriptionRegistry.getByKey(subscriptionKey);
    let cleanedCount = 0;

    for (const sub of allSubscribers) {
        // Extract connectionId from scope (format: "subscriber:connection:connectionId")
        const scopeParts = sub.scope.split(':');
        const scopeConnId = scopeParts[scopeParts.length - 1];

        // Skip the current connection
        if (currentConnectionId && scopeConnId === currentConnectionId) {
            continue;
        }

        // Check if this connection still exists
        const subConn = ConnectionManager.getConnection(scopeConnId);
        if (!subConn) {
            logger.debug('[SubscriptionCleanup] Removing stale subscription', {
                subscriptionId: sub.id,
                subscriptionKey: sub.key,
                staleConnectionId: scopeConnId
            });

            await subscriptionRegistry.removeSubscription(sub.key, sub.scope);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        logger.info(`[SubscriptionCleanup] Cleaned up ${cleanedCount} stale subscription(s) for ${subscriptionKey}`);
    }

    return cleanedCount;
}

