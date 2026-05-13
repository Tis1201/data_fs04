import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { ConnectionManager } from '$lib/server/messaging/core/connectionManager';
import { connectionSharedStore } from '$lib/server/messaging/core/stores/connectionSharedStore';
import { logger } from '$lib/server/logger';

// POST endpoint to log connection information without removing any connections
export const POST = restrict(
async () => {
		try {
			// Get all connection metas
			const connectionMetas = await connectionSharedStore.getAllMembers();
			
			// Log information about connections
			const now = Date.now();
			const activeConnections = connectionMetas.map(conn => {
				const connectedAt = conn.connectedAt || 0;
				const age = now - connectedAt;
				return {
					id: conn.id,
					protocol: conn.protocol,
					age: Math.floor(age / 1000) + " seconds",
					userId: conn.userInfo?.id || "anonymous"
				};
			});
			
			// Log connection information instead of removing them
			logger.info(`Active connections: ${JSON.stringify(activeConnections)}`);
			
			return json({
success: true,
message: `Found ${connectionMetas.length} active connections`,
connections: activeConnections
});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			logger.error('Error processing connections:', { err });
			return json({ success: false, error: errorMessage }, { status: 500 });
		}
	},
	[SystemRole.ADMIN]
);
