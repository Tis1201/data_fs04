import type { RoutingMessage } from './message';

// src/lib/server/messaging/interfaces/subscription.ts
export interface SubscriptionMeta {
    id: string; // unique subscription id
    routingKey: string; // topic/channel
    subscriberId: string; // user or connection id
    createdAt: number;
    // ...any other relevant fields
}

export interface Publisher {
    publish(message: RoutingMessage): Promise<void>;
}