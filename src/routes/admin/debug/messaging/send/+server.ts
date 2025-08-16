import { json } from '@sveltejs/kit';
import { publisher } from '$lib/server/messaging/core/publisher';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import type { RoutingMessage } from '$lib/server/messaging/interfaces/message';
import { logger } from '$lib/server/logger';

/**
 * POST handler for sending test messages from the admin debug UI
 */
export const POST = restrict(
    async ({ request, locals, auth }) => {
        try {
            const body = await request.json();
            const { type, scope, payload } = body;
            
            if (!type || !scope) {
                return json({ success: false, error: 'Missing required fields: type and scope' }, { status: 400 });
            }
            
            logger.debug(`Admin sending test message: type=${type}, scope=${scope}`);
            
            // Build a routing message compatible with the current publisher
            const message: RoutingMessage = {
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

            return json({ success: true, scope, type });
        } catch (err) {
            logger.error(`Error sending test message: ${err.message}`, { error: err });
            return json({ success: false, error: err.message }, { status: 500 });
        }
    },
    [SystemRole.ADMIN]
);
