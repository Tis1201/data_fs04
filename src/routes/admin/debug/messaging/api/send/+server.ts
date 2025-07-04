import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { publisher } from '$lib/server/messaging/core/publisher';

// POST endpoint to send a test message
export const POST = restrict(
	async ({ request, auth }) => {
		try {
			const data = await request.json();
			const { type, scope, payload } = data;
			
			// Create a routing message
			const message = {
				id: crypto.randomUUID(),
				type,
				scope,
				payload,
				userInfo: auth.user,
				connectionId: `debug-${crypto.randomUUID()}`,
				protocol: 'debug' as any,
				systemGenerated: false,
				echoToSender: false,
				sudo: false
			};
			
			// Publish the message
			await publisher.publish(message);
			
			return json({ success: true, message: 'Message sent successfully' });
		} catch (err) {
			console.error('Error sending test message:', err);
			return json({ success: false, error: err.message }, { status: 500 });
		}
	},
	[SystemRole.ADMIN]
);
