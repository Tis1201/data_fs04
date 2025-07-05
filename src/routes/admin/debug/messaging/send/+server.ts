import { json } from '@sveltejs/kit';
import { publisher } from '$lib/server/messaging/core/publisher';
import { restrict } from '$lib/server/security/guards';
import pkg from '@prisma/client';
const { SystemRole } = pkg;
import { createMessage } from '$lib/server/messaging/interfaces/message';
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
            
            // Create a message with the provided type and payload
            const message = createMessage({
                type,
                payload,
                meta: {
                    source: 'admin-debug',
                    adminId: auth.user.id,
                    adminName: auth.user.name,
                    timestamp: Date.now()
                }
            });
            
            // Publish the message to the specified scope
            const result = await publisher.publish({
                message,
                scope
            });
            
            return json({
                success: true,
                recipientCount: result.recipientCount,
                scope,
                type
            });
        } catch (err) {
            logger.error(`Error sending test message: ${err.message}`, { error: err });
            return json({ success: false, error: err.message }, { status: 500 });
        }
    },
    [SystemRole.ADMIN]
);
