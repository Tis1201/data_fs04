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

    const all_subscribers = await subscriptionRegistry.getAll();

    // for (const sub of all_subscribers) {
    //   logger.debug(`[SubscriptionRouter] All subscriber: ${JSON.stringify(sub)}`);
    // }

    //Lookup Subscription Registry and return the subscribers
    const subscribers = await subscriptionRegistry.getByKey(scope);

    logger.debug(`[SubscriptionRouter] Found ${subscribers.length} subscribers for scope: ${scope}`);

    const subscriberScopes = subscribers.map(sub => sub.scope);

    logger.debug(`[SubscriptionRouter] Subscriber scopes: ${JSON.stringify(subscriberScopes)}`);

    const result = new Set<string>();

    for(const subscriberScope of subscriberScopes) {
      console.log(`[SubscriptionRouter] ===== PROCESSING SUBSCRIBER SCOPE =====`);
      console.log(`[SubscriptionRouter] Subscriber scope: ${subscriberScope}`);
      
      const [kind, ...rest] = subscriberScope.split(':');
      const scope_of_interest = rest.join(':');
      console.log(`[SubscriptionRouter] Kind: ${kind}, Scope of interest: ${scope_of_interest}`);
      
      const connectionIds = await router.resolve(senderInfo, scope_of_interest);
      console.log(`[SubscriptionRouter] Resolved connection IDs:`, connectionIds);
      
      connectionIds.forEach(id => {
        console.log(`[SubscriptionRouter] Adding connection ID to result: ${id}`);
        result.add(id);
      });
    }

    logger.debug(`[SubscriptionRouter] Found ${result.size} connections for scope: ${scope}`);

    return Array.from(result);
    // let targeted_user_id = id;
    // if (targeted_user_id === 'self') targeted_user_id = senderInfo?.id;

    // const connections = await ConnectionManager.getConnectionsByUser(targeted_user_id);

    // logger.debug(`[UserRouter] Found ${connections.length} connections for user: ${id}`);

    // // Optionally: connectionSharedStore.debugPrint?.();

    // return connections.map(c => c.id);
  }
};