// src/lib/server/messaging/core/subscriptionRegistry.ts
import type { SubscriptionMeta, SubscriptionRegistry } from "../interfaces/subscriptionRegistry";
import { v4 as uuidv4 } from 'uuid';
import { subscriptionSharedStore } from "./stores/subscriptionSharedStore copy";

export const subscriptionRegistry: SubscriptionRegistry = {
    async add(subscription) {
        // Add a SubscriptionMeta to the set for the given key
        await subscriptionSharedStore.addMember(subscription.key, subscription);
    },

    async addSubscription(key, scope) {
        const subscription: SubscriptionMeta = {
            id: uuidv4(),
            key,
            scope
        };
        return subscriptionSharedStore.addMember(key, subscription);
    },

    async remove(key) {
        // Remove all subscriptions for a topic/channel (removes the entire set)
        await subscriptionSharedStore.remove(key);
    },

    async removeSubscription(key, scope) {
        // Remove a specific subscriber from a topic/channel
        const members = await subscriptionSharedStore.getMembers(key);
        const toRemove = members.filter(sub => sub.scope === scope);
        for (const sub of toRemove) {
            await subscriptionSharedStore.removeMember(key, sub);
        }
    },

    async getAll() {
        // Return all SubscriptionMeta objects
        return subscriptionSharedStore.getAllMembers();
    },

    async getByUser(userId) {
        // Assumes scope follows 'subscriber:user:userId'
        const all = await subscriptionSharedStore.getAllMembers();
        return all.filter(sub => sub.scope === `subscriber:user:${userId}`);
    },

    async getByKey(key) {
        // Get all subscriptions for a specific key (topic/channel)
        return subscriptionSharedStore.getMembers(key);
    },

    async getByScope(scope) {
        // Get all subscriptions for a specific scope (subscriber)
        const all = await subscriptionSharedStore.getAllMembers();
        return all.filter(sub => sub.scope === scope);
    }
};