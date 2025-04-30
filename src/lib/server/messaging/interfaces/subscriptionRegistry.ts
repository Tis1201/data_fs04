
export interface SubscriptionMeta {
    id: string; // unique subscription id
    key: string; // topic/channel
    scope: string; // user or connection id
}

export interface SubscriptionRegistry {
    /**
     * Add a new subscription (id is generated internally).
     */
    addSubscription(key: string, scope: string): Promise<void>;
  
    /**
     * Add a subscription with a fully specified SubscriptionMeta (for advanced use).
     */
    add(subscription: SubscriptionMeta): Promise<void>;
  
    /**
     * Remove a specific subscriber from a topic/channel.
     */
    removeSubscription(key: string, scope: string): Promise<void>;
  
    /**
     * Remove all subscriptions for a topic/channel (removes the entire set).
     */
    remove(key: string): Promise<void>;
  
    /**
     * Get all subscriptions (across all keys/scopes).
     */
    getAll(): Promise<SubscriptionMeta[]>;
  
    /**
     * Get all subscriptions for a specific user.
     * (Assumes scope follows 'subscriber:user:userId' convention.)
     */
    getByUser(userId: string): Promise<SubscriptionMeta[]>;
  
    /**
     * Get all subscriptions for a specific key (topic/channel).
     */
    getByKey(key: string): Promise<SubscriptionMeta[]>;
  
    /**
     * Get all subscriptions for a specific scope (subscriber).
     */
    getByScope(scope: string): Promise<SubscriptionMeta[]>;
  }


