import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { AuditLogger } from '$lib/server/messaging/core/auditLogger';

// POST endpoint to clear message traces
export const POST = restrict(
	async () => {
		try {
			AuditLogger.clearTraces();
			return json({ success: true, message: 'Message traces cleared' });
		} catch (err) {
			console.error('Error clearing message traces:', err);
			return json({ success: false, error: err.message }, { status: 500 });
		}
	},
	[SystemRole.ADMIN]
);
