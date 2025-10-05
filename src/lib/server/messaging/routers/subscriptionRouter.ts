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

    // DEBUG: Log subscription resolution attempt
    logger.info(`[DEBUG] SubscriptionRouter resolving scope: ${scope}`, {
      kind,
      resource,
      id,
      senderInfo: senderInfo?.id
    });

    const all_subscribers = await subscriptionRegistry.getAll();

    // DEBUG: Log all subscriptions
    logger.info(`[DEBUG] All subscriptions in registry:`, {
      count: all_subscribers.length,
      subscriptions: all_subscribers.map(sub => ({ key: sub.key, scope: sub.scope }))
    });

    //Lookup Subscription Registry and return the subscribers
    const subscribers = await subscriptionRegistry.getByKey(scope);

    // DEBUG: Log specific subscribers for this scope
    logger.info(`[DEBUG] Subscribers for scope ${scope}:`, {
      count: subscribers.length,
      subscribers: subscribers.map(sub => ({ key: sub.key, scope: sub.scope }))
    });

    const subscriberScopes = subscribers.map(sub => sub.scope);

    const result = new Set<string>();

    for(const subscriberScope of subscriberScopes) {
      const [kind, ...rest] = subscriberScope.split(':');
      const scope_of_interest = rest.join(':');
      
      // logger.info(`[DEBUG] Resolving subscriber scope: ${subscriberScope} -> ${scope_of_interest}`);
      
      const connectionIds = await router.resolve(senderInfo, scope_of_interest);
      
      // logger.info(`[DEBUG] Subscriber scope resolved to connections:`, {
      //   subscriberScope,
      //   scope_of_interest,
      //   connectionIds
      // });
      
      connectionIds.forEach(id => {
        result.add(id);
      });
    }

    logger.info(`[DEBUG] SubscriptionRouter final result:`, {
      scope,
      totalConnections: result.size,
      connections: Array.from(result)
    });

    // DEBUG: Log if no connections found
    if (result.size === 0) {
      logger.warn(`[DEBUG] No active connections found for scope: ${scope}`);
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