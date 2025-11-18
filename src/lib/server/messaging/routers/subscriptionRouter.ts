import type { Router } from '../interfaces/router';
import { ConnectionManager } from '../core/connectionManager';
import { logger } from '$lib/server/logger';
import type { UserInfo } from '$lib/server/types/user';
import { subscriptionRegistry } from '../core/subscriptionRegistry';
import { router } from '../core/router';

/**
 * UserRouter implements the Router interface for user-based routing.
 */
export const subscriptionRouter: Router = {
  async resolve(senderInfo: UserInfo, scope: string): Promise<string[]> {
    
    //e.g. subscription:whatsapp:clientId 
    const [kind, resource, id] = scope.split(':');

    // Debug logging only at debug level
    logger.debug(`[SubscriptionRouter] Resolving scope: ${scope}`, {
      kind,
      resource,
      id,
      senderInfo: senderInfo?.id
    });

    const all_subscribers = await subscriptionRegistry.getAll();

    // Debug logging only at debug level
    logger.debug(`[SubscriptionRouter] All subscriptions in registry:`, {
      count: all_subscribers.length,
      subscriptions: all_subscribers.map(sub => ({ key: sub.key, scope: sub.scope }))
    });

    //Lookup Subscription Registry and return the subscribers
    const subscribers = await subscriptionRegistry.getByKey(scope);

    // Debug logging only at debug level
    logger.debug(`[SubscriptionRouter] Subscribers for scope ${scope}:`, {
      count: subscribers.length,
      subscribers: subscribers.map(sub => ({ key: sub.key, scope: sub.scope }))
    });

    const subscriberScopes = subscribers.map(sub => sub.scope);

    const result = new Set<string>();

    for(const subscriberScope of subscriberScopes) {
      const [kind, ...rest] = subscriberScope.split(':');
      const scope_of_interest = rest.join(':');
      
      const connectionIds = await router.resolve(senderInfo, scope_of_interest);
      
      connectionIds.forEach(id => {
        result.add(id);
      });
    }

    logger.debug(`[SubscriptionRouter] Final result:`, {
      scope,
      totalConnections: result.size,
      connections: Array.from(result)
    });

    // Only warn if no connections found (this is important to know)
    if (result.size === 0) {
      logger.debug(`[SubscriptionRouter] No active connections found for scope: ${scope}`);
    }

    return Array.from(result);
    // let targeted_user_id = id;
    // if (targeted_user_id === 'self') targeted_user_id = senderInfo?.id;

    // const connections = await ConnectionManager.getConnectionsByUser(targeted_user_id);

    // logger.debug(`[UserRouter] Found ${connections.length} connections for user: ${id}`);

    // // Optionally: connectionSharedStore.debugPrint?.();

    // return connections.map(c => c.id);
  }
};