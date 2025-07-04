import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { connectionSharedStore } from '$lib/server/messaging/core/stores/connectionSharedStore';
import { logger } from '$lib/server/logger';

// POST endpoint to clean up stale connections
export const POST = restrict(
	async () => {
		try {
			// Get all connection metas
			const connectionMetas = await connectionSharedStore.getAllMembers();
			
			// Find connections that are older than 30 seconds and might be stale
			const now = Date.now();
			const staleConnections = connectionMetas.filter(conn => {
				const connectedAt = conn.connectedAt || 0;
				const age = now - connectedAt;
				return age > 30000; // 30 seconds
			});
			
			// Clean up stale connections
			for (const conn of staleConnections) {
				if (conn.id) {
					logger.info(`Cleaning up potentially stale connection: ${conn.id}`);
					ConnectionManager.unregisterConnection(conn.id);
				}
			}
			
			return json({
				success: true,
				message: `Cleaned up ${staleConnections.length} stale connections`
			});
		} catch (err) {
			console.error('Error cleaning up stale connections:', err);
			return json({ success: false, error: err.message }, { status: 500 });
		}
	},
	[SystemRole.ADMIN]
);
