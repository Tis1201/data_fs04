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
			console.error('Error fetching message traces:', err);
			return json({ success: false, error: err.message }, { status: 500 });
		}
	},
	[SystemRole.ADMIN]
);
