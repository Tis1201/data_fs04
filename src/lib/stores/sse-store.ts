import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type SSEMessage = {
    id: string;
    event: string;
    content?: string;
    data: any;
    timestamp: string;
    sender?: {
        email: string;
        name: string | null;
    };
};

type SSEStatus = 'CONNECTING' | 'OPEN' | 'CLOSED' | 'ERROR';

interface SSEState {
    status: SSEStatus;
    error: Error | null;
    lastEvent: SSEMessage | null;
    connectionId: string | null;
    messages: SSEMessage[];
}

/**
 * Creates a simple Svelte store that manages a Server-Sent Events connection.
 * Uses the browser's built-in EventSource with automatic reconnection.
 */
function createSSEStore() {
    // If not running in browser (SSR), return a no-op store
    if (!browser) {
        const { subscribe } = writable<SSEState>({
            status: 'CLOSED',
            error: null,
            lastEvent: null,
            connectionId: null,
            messages: []
        });
        return {
            subscribe,
            connect: () => {},
            disconnect: () => {},
            on: () => () => {},
            clearMessages: () => {}
        };
    }

    const { subscribe, update, set } = writable<SSEState>({
        status: 'CLOSED',
        error: null,
        lastEvent: null,
        connectionId: null,
        messages: []
    });

    let eventSource: EventSource | null = null;
    const messageListeners: Record<string, ((message: SSEMessage) => void)[]> = {};

    /**
     * Add a message to the store and notify listeners
     */
    const addMessage = (message: SSEMessage) => {
        update(state => ({
            ...state,
            messages: [...state.messages, message].slice(-100), // Keep last 100 messages
            lastEvent: message
        }));
        
        // Notify listeners for this event type and wildcard listeners
        const listeners = [
            ...(messageListeners[message.event] || []),
            ...(messageListeners['*'] || [])
        ];
        
        listeners.forEach(cb => {
            try {
                cb(message);
            } catch (err) {
                console.error(`SSE listener error [${message.event}]:`, err);
            }
        });
    };

    /**
     * Connect to an SSE endpoint
     */
    function connect(url: string, options: { withCredentials?: boolean } = {}) {
        if (!browser) return;

        // Close existing connection if any
        disconnect();

        // Update state
        set({
            status: 'CONNECTING',
            error: null,
            lastEvent: null,
            connectionId: null,
            messages: []
        });

        try {
            console.log(`[SSE] Connecting to ${url}`);
            eventSource = new EventSource(url, {
                withCredentials: options.withCredentials ?? true
            });

            eventSource.onopen = () => {
                console.log(`[SSE] Connected to ${url}`);
                update(state => ({
                    ...state,
                    status: 'OPEN',
                    error: null
                }));
            };

            eventSource.onmessage = (event) => {
                try {
                    if (!event.data) {
                        console.warn('[SSE] Received empty message');
                        return;
                    }

                    const data = JSON.parse(event.data);
                    const message: SSEMessage = {
                        id: data.id || crypto.randomUUID(),
                        event: event.type === 'message' ? (data.event || 'message') : event.type,
                        content: typeof data === 'string' ? data : data.content,
                        data,
                        timestamp: data.timestamp || new Date().toISOString(),
                        sender: data.sender
                    };

                    // Handle connection ID from connected event
                    if (message.event === 'connected' && message.data?.connectionId) {
                        update(state => ({
                            ...state,
                            connectionId: message.data.connectionId
                        }));
                        console.log(`[SSE] Received connection ID: ${message.data.connectionId}`);
                    }

                    addMessage(message);
                } catch (err) {
                    console.error('[SSE] Error processing message:', err, 'Raw data:', event.data);
                }
            };

            eventSource.onerror = (event) => {
                console.error('[SSE] Connection error:', event);
                
                update(state => ({
                    ...state,
                    status: 'ERROR',
                    error: new Error('SSE connection error')
                }));
                
                // Note: The browser will automatically attempt to reconnect
            };

            // Set up specific event listeners if needed
            ['connected', 'webhook', 'notification'].forEach(eventType => {
                eventSource.addEventListener(eventType, eventSource.onmessage);
            });

        } catch (error) {
            console.error('[SSE] Failed to create connection:', error);
            set({
                status: 'ERROR',
                error: error instanceof Error ? error : new Error('Failed to create SSE connection'),
                lastEvent: null,
                connectionId: null,
                messages: []
            });
        }
    }

    /**
     * Close the SSE connection
     */
    function disconnect() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        
        update(state => ({
            ...state,
            status: 'CLOSED'
        }));
        
        console.log('[SSE] Disconnected');
    }

    /**
     * Clear the message history without affecting the connection
     */
    function clearMessages() {
        update(state => ({ ...state, messages: [] }));
    }

    /**
     * Subscribe to specific event types
     */
    function on(event: string, callback: (message: SSEMessage) => void) {
        if (!messageListeners[event]) {
            messageListeners[event] = [];
        }
        
        messageListeners[event].push(callback);
        
        // Return unsubscribe function
        return () => {
            if (messageListeners[event]) {
                messageListeners[event] = messageListeners[event].filter(cb => cb !== callback);
                if (messageListeners[event].length === 0) {
                    delete messageListeners[event];
                }
            }
        };
    }

    return {
        // Core functionality
        subscribe,
        connect,
        disconnect,
        on,
        clearMessages,
        
        // Helper methods
        get isConnected() {
            let connected = false;
            const unsubscribe = subscribe(state => {
                connected = state.status === 'OPEN';
            });
            unsubscribe();
            return connected;
        },
        
        get connectionId() {
            return get({ subscribe }).connectionId;
        },
        
        get lastEvent() {
            return get({ subscribe }).lastEvent;
        }
    };
}

// Create a singleton instance
export const sseStore = createSSEStore();

/**
 * Helper function for type-safe event listening
 */
export function onSSEEvent<T = any>(
    event: string,
    callback: (data: T, message: SSEMessage) => void
) {
    return sseStore.on(event, (message) => {
        callback(message.data, message);
    });
}

// Auto-cleanup on page unload if in browser
if (browser) {
    window.addEventListener('beforeunload', () => {
        sseStore.disconnect();
    });
}