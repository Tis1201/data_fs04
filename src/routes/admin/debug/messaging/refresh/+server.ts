import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
    try {
        // Get all active connections
        const connections = await ConnectionManager.getAllConnectionMetas();
        
        // Get all active subscriptions
        const subscriptions = await subscriptionRegistry.getAll();
        
        // Group connections by user and collect statistics
        const userConnections: Record<string, any[]> = {};
        const mqttUserIds = new Set<string>();
        const whatsappConnections = new Set<string>();
        const deviceConnections = new Set<string>();

        connections.forEach(conn => {
            const userId = conn.userInfo?.id || 'anonymous';
            if (!userConnections[userId]) {
                userConnections[userId] = [];
            }
            userConnections[userId].push(conn);

            // Track MQTT connections
            if (conn.protocol === 'mqtt' && userId !== 'anonymous') {
                mqttUserIds.add(userId);
            }

            // Track WhatsApp connections
            if (conn.whatsapp?.clientId) {
                whatsappConnections.add(conn.whatsapp.clientId);
            }

            // Track device connections
            if (conn.deviceId) {
                deviceConnections.add(conn.deviceId);
            }
        });
        
        // Group subscriptions by key
        const keySubscriptions: Record<string, any[]> = {};
        subscriptions.forEach(sub => {
            if (!keySubscriptions[sub.key]) {
                keySubscriptions[sub.key] = [];
            }
            keySubscriptions[sub.key].push(sub);
        });

        return json({
            success: true,
            connections,
            subscriptions,
            userConnections,
            keySubscriptions,
            connectionCount: connections.length,
            subscriptionCount: subscriptions.length,
            userCount: Object.keys(userConnections).length,
            stats: {
                mqttUsers: mqttUserIds.size,
                whatsappConnections: whatsappConnections.size,
                deviceConnections: deviceConnections.size
            }
        });
    } catch (error) {
        console.error('Error refreshing messaging data:', error);
        return json(
            { success: false, error: 'Failed to refresh messaging data' },
            { status: 500 }
        );
    }
};
