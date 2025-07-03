import { json } from '@sveltejs/kit';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { restrict } from '$lib/server/security/guards';
import pkg from '@prisma/client';
import { SystemRole } from '$lib/types/roles';

/**
 * GET handler for retrieving messaging system data in JSON format
 * Used for AJAX refreshes of the messaging debug UI
 */
export const GET = restrict(
    async ({ locals }) => {
        // Get all connections
        const connections = await ConnectionManager.getAllConnectionMetas();
        
        // Group connections by user
        const userConnections = {};
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
        const keySubscriptions = {};
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
