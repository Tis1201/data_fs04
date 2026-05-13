import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { logger } from '$lib/server/logger';

/**
 * GET /api/v2/admin/debug/connections
 * Get connection and subscription statistics (Admin only)
 * Provides debugging information about active MQTT/WebSocket connections
 */
export const GET: RequestHandler = unifiedEndpoint(
	async () => {
		// Get connection statistics
		const connectionCount = ConnectionManager.getLiveConnectionCount();
		const allConnections = await ConnectionManager.getAllConnectionMetas();
		
		// Get subscription statistics
		const allSubscriptions = await subscriptionRegistry.getAll();
		
		// Group subscriptions by key to see which channels have the most subscribers
		const subscriptionCounts: Record<string, number> = {};
		allSubscriptions.forEach(sub => {
			subscriptionCounts[sub.key] = (subscriptionCounts[sub.key] || 0) + 1;
		});
		
		// Find channels with high subscription counts (potential issues)
		const highSubscriptionChannels = Object.entries(subscriptionCounts)
			.filter(([_, count]) => count > 10)
			.sort(([_, a], [__, b]) => b - a);
		
		// Group connections by user
		const userConnections: Record<string, number> = {};
		allConnections.forEach(conn => {
			const userId = conn.userInfo?.id;
			if (userId) {
				userConnections[userId] = (userConnections[userId] || 0) + 1;
			}
		});
		
		// Find users with many connections (potential issues)
		const usersWithManyConnections = Object.entries(userConnections)
			.filter(([_, count]) => count > 5)
			.sort(([_, a], [__, b]) => b - a);
		
		const stats = {
			timestamp: new Date().toISOString(),
			connections: {
				total: connectionCount,
				byUser: userConnections,
				usersWithManyConnections,
				allConnections: allConnections.map(conn => ({
					id: conn.id,
					userId: conn.userInfo?.id,
					protocol: conn.protocol,
					createdAt: conn.createdAt
				}))
			},
			subscriptions: {
				total: allSubscriptions.length,
				byChannel: subscriptionCounts,
				highSubscriptionChannels,
				allSubscriptions: allSubscriptions.map(sub => ({
					id: sub.id,
					key: sub.key,
					scope: sub.scope
				}))
			}
		};
		
		logger.info(`[Debug] Connection stats: ${connectionCount} connections, ${allSubscriptions.length} subscriptions`);
		if (highSubscriptionChannels.length > 0) {
			logger.warn(`[Debug] High subscription channels: ${JSON.stringify(highSubscriptionChannels)}`);
		}
		if (usersWithManyConnections.length > 0) {
			logger.warn(`[Debug] Users with many connections: ${JSON.stringify(usersWithManyConnections)}`);
		}
		
		return {
			success: true,
			data: stats
		};
	},
	{ permission: 'admin.debug' }
);

