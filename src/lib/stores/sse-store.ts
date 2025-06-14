import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { generateRequestId } from "$lib/utils/ApiUtils";


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
            clearMessages: () => {},
            sendRequest: () => Promise.reject(new Error('Not available during SSR'))
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
    const pendingRequests: Record<string, {
        resolve: (value: any) => void;
        reject: (reason: any) => void;
        timer: ReturnType<typeof setTimeout>;
    }> = {};

    /**
     * Add a message to the store and notify listeners
     */
    const addMessage = (message: SSEMessage) => {
        update(state => {
            // Ensure messages is always an array
            const messages = Array.isArray(state.messages) ? state.messages : [];
            return {
                ...state,
                messages: [...messages, message].slice(-100), // Keep last 100 messages
                lastEvent: message
            };
        });
        
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

                    // Check if this message is a response to a pending request
                    const requestId = data.requestId || (data.payload?.requestId as string);
                    if (requestId && pendingRequests[requestId]) {
                        console.log(`[SSE] Received response for request: ${requestId}`);
                        const { resolve, timer } = pendingRequests[requestId];
                        clearTimeout(timer);
                        delete pendingRequests[requestId];
                        resolve(data);
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
    

    
    /**
     * Send a message request to the SSE server
     * @param partialMsg Message with type, scope and payload
     * @param timeoutMs Timeout in milliseconds
     * @param requestIdPrefix Optional prefix for the request ID
     * @returns Promise that resolves with the response or rejects on timeout/error
     */
    function sendRequest(
        partialMsg: { type: string; scope: string; payload: Record<string, any>; requestId?: string },
        timeoutMs = 5000,
        requestIdPrefix = ''
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            // Generate a unique request ID if not provided
            const requestId = partialMsg.requestId || generateRequestId(requestIdPrefix);
            
            // Create the full message with timestamp and request ID as a first-class property
            const message = {
                ...partialMsg,
                timestamp: new Date().toISOString(),
                requestId
            };
            
            console.log(`[SSE] Sending request ${requestId}:`, message);
            
            // Start a timer to reject if no response arrives within timeoutMs
            const timer = setTimeout(() => {
                delete pendingRequests[requestId];
                reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            
            // Store resolve/reject + timer so that onmessage can resolve them
            pendingRequests[requestId] = { resolve, reject, timer };
            
            // Send the message via POST to the SSE endpoint
            fetch('/api/sse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(message)
            })
            .then(response => {
                if (!response.ok) {
                    // Only handle HTTP errors here, not the actual response
                    // The actual response will come through the SSE connection
                    return response.json().then(errorData => {
                        throw new Error(`SSE request failed: ${errorData.error || response.statusText}`);
                    });
                }
                // Don't resolve here - wait for the SSE message with matching requestId
            })
            .catch(error => {
                // Only handle fetch errors (network issues, etc.)
                console.error('[SSE] Send request failed:', error);
                clearTimeout(timer);
                delete pendingRequests[requestId];
                reject(error);
            });
        });
    }

    return {
        // Core functionality
        subscribe,
        connect,
        disconnect,
        on,
        clearMessages,
        sendRequest,
        
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