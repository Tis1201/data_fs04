import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { subscriptionRegistry } from '$lib/server/messaging/core/subscriptionRegistry';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';

// GET endpoint to fetch messaging debug data
export const GET = restrict(
async () => {
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
			
			// Get active WhatsApp client IDs - FIX: Access as a property, not a method
			const whatsAppClients = whatsAppAccountManager.getAllClientIds;
			
			return json({
success: true,
connections,
subscriptions,
userConnections,
keySubscriptions,
connectionCount: connections.length,
subscriptionCount: subscriptions.length,
userCount: Object.keys(userConnections).length,
whatsAppClients,
whatsAppClientCount: whatsAppClients.length
});
		} catch (err) {
			console.error('Error fetching messaging debug data:', err);
			const message = err instanceof Error ? err.message : 'Unknown error';
			return json({ success: false, error: message }, { status: 500 });
		}
	},
	[SystemRole.ADMIN]
);
