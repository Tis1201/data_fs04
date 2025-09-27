// src/lib/server/messaging/core/subscriptionRegistry.ts
import type { SubscriptionMeta, SubscriptionRegistry } from "../interfaces/subscriptionRegistry";
import { v4 as uuidv4 } from 'uuid';
import { subscriptionSharedStore } from "./stores/subscriptionSharedStore";
import { logger } from "$lib/server/logger";

export const subscriptionRegistry: SubscriptionRegistry = {
    async add(subscription) {
        // Add a SubscriptionMeta to the set for the given key
        await subscriptionSharedStore.addMember(subscription.key, subscription);
    },

    async addSubscription(key, scope) {

        logger.debug(`[SubscriptionRegistry] Adding subscription: ${key} for scope: ${scope}`);

        const subscription: SubscriptionMeta = {
            id: uuidv4(),
            key,
            scope
        };
        
        try {
            await subscriptionSharedStore.addMember(key, subscription);
            logger.info(`[SubscriptionRegistry] Successfully added subscription: ${key} for scope: ${scope} (id: ${subscription.id})`);
        } catch (error) {
            logger.error(`[SubscriptionRegistry] Failed to add subscription: ${key} for scope: ${scope}: ${error}`);
            throw error;
        }
    },

    async remove(key) {
        // Remove all subscriptions for a topic/channel (removes the entire set)
        await subscriptionSharedStore.remove(key);
    },

    async removeSubscription(key, scope) {
        logger.debug(`Removing subscription: ${key} for scope: ${scope}`);
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
        const members = await subscriptionSharedStore.getMembers(key);
        logger.debug(`[SubscriptionRegistry] getByKey(${key}) returned ${members.length} members:`, members.map(m => `${m.scope} (id: ${m.id})`));
        return members;
    },

    async getByScope(scope) {
        // Get all subscriptions for a specific scope (subscriber)
        const all = await subscriptionSharedStore.getAllMembers();
        return all.filter(sub => sub.scope === scope);
    }
};