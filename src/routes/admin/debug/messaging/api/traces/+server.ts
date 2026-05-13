import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { AuditLogger } from '$lib/server/messaging/core/auditLogger';

// GET endpoint to fetch message traces
export const GET = restrict(
	async () => {
		try {
			const messageTraces = AuditLogger.getTraces();
			return json({ success: true, messageTraces });
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			console.error('Error fetching message traces:', errorMessage);
			return json({ success: false, error: errorMessage }, { status: 500 });
		}
	},
	[SystemRole.ADMIN]
);
