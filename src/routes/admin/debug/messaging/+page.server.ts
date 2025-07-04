import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { restrict } from '$lib/server/security/guards';
import pkg from '@prisma/client';
import { SystemRole } from '$lib/types/roles';
import { error } from '@sveltejs/kit';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';

export const load = restrict(
	async ({ locals, userInfo }:any) => {
		try {
			// Get all active connections
			const connections = await ConnectionManager.getAllConnectionMetas();
			
			// Get all active subscriptions
			const subscriptions = await subscriptionRegistry.getAll();
			
			// Group connections by user
			const userConnections: Record<string, any[]> = {};
			connections.forEach(conn => {
				const userId = conn.userInfo?.id || 'anonymous';
				if (!userConnections[userId]) {
					userConnections[userId] = [];
				}
				userConnections[userId].push(conn);
			});
			
			// Group subscriptions by key
			const keySubscriptions: Record<string, any[]> = {};
			subscriptions.forEach(sub => {
				if (!keySubscriptions[sub.key]) {
					keySubscriptions[sub.key] = [];
				}
				keySubscriptions[sub.key].push(sub);
			});
			
			// Get active WhatsApp client IDs
			const whatsAppClients = whatsAppAccountManager.getAllClientIds;
			
			return {
				connections,
				subscriptions,
				userConnections,
				keySubscriptions,
				connectionCount: connections.length,
				subscriptionCount: subscriptions.length,
				userCount: Object.keys(userConnections).length,
				whatsAppClients,
				whatsAppClientCount: whatsAppClients.length
			};
		} catch (err) {
			console.error('Error loading messaging debug data:', err);
			throw error(500, 'Failed to load messaging system data');
		}
	},
	[SystemRole.ADMIN]
);
