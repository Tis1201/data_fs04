import { sseManager } from './sse-manager';

export { sseManager };

/**
 * Broadcast a message to all connected SSE clients
 * @param event The event name
 * @param data The data to send
 */
export function broadcastMessage(
    event: string,
    data: unknown
) {
    sseManager.broadcast(event, data);
}
