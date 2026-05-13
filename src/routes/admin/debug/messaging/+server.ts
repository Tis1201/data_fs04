import { json, type RequestHandler } from '@sveltejs/kit';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

/**
 * GET handler for retrieving messaging system data in JSON format
 * Used for AJAX refreshes of the messaging debug UI
 */
export const GET = restrict(
    async ({ locals }: AuthenticatedEvent) => {
        // Get all connections
        const connections = await ConnectionManager.getAllConnectionMetas();
        
        // Group connections by user
        const userConnections: Record<string, typeof connections> = {};
        connections.forEach(conn => {
            const userId = conn.userInfo?.id || 'anonymous';
            if (!userConnections[userId]) {
                userConnections[userId] = [];
            }
            userConnections[userId].push(conn);
        });
        
        // Get all subscriptions
        const subscriptions = await subscriptionRegistry.getAll();
        
        // Group subscriptions by key
        const keySubscriptions: Record<string, typeof subscriptions> = {};
        subscriptions.forEach(sub => {
            const key = sub.key;
            if (!keySubscriptions[key]) {
                keySubscriptions[key] = [];
            }
            keySubscriptions[key].push(sub);
        });
        
        // Count unique users
        const userCount = Object.keys(userConnections).length;
        
        return json({
            connections,
            subscriptions,
            userConnections,
            keySubscriptions,
            connectionCount: connections.length,
            subscriptionCount: subscriptions.length,
            userCount
        });
    },
    [SystemRole.ADMIN]
);
