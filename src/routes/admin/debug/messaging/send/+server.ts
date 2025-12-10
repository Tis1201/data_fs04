import { json, type RequestEvent } from '@sveltejs/kit';
import { publisher } from '$lib/server/messaging/core/publisher';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import type { RoutingMessage } from '$lib/server/messaging/interfaces/message';
import { logger } from '$lib/server/logger';

/**
 * POST handler for sending test messages from the admin debug UI
 */
export const POST = restrict(
    async ({ request, auth }: AuthenticatedEvent) => {
        try {
            const body = await request.json();
            const { type, scope, payload } = body;
            
            if (!type || !scope) {
                return json({ success: false, error: 'Missing required fields: type and scope' }, { status: 400 });
            }
            
            if (!auth?.user) {
                return json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }

            logger.debug(`Admin sending test message: type=${type}, scope=${scope}`);
            
            // Build a routing message compatible with the current publisher
            const message: RoutingMessage = {
                id: crypto.randomUUID(),
                type,
                scope,
                payload,
                userInfo: {
                    id: auth.user.id,
                    email: auth.user.email,
                    name: auth.user.name,
                    systemRole: auth.user.systemRole,
                    source: 'session'
                },
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
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logger.error('Error sending test message', { err });
            return json({ success: false, error: errorMessage }, { status: 500 });
        }
    },
    [SystemRole.ADMIN]
);
