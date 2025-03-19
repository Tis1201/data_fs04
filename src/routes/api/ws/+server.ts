import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
    // This endpoint doesn't do anything directly
    // WebSocket connections are handled by the WebSocketServer in hooks.server.ts
    return json({ status: 'WebSocket server is running' });
};
