import type { SubscriptionMeta } from "../interfaces/publisher";

export interface SubscriptionRegistry {
    add(subscription: SubscriptionMeta): Promise<void>;
    remove(subscriptionId: string): Promise<void>;
    getAll(): Promise<SubscriptionMeta[]>;
    getByUser(userId: string): Promise<SubscriptionMeta[]>;
}