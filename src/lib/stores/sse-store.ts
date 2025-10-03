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
            // Ensure messages is always an array and limit to last 10 messages
            const messages = Array.isArray(state.messages) ? state.messages : [];
            // Keep only the last 9 messages and add the new one (total 10)
            const updatedMessages = [...messages, message].slice(-10);
            return {
                ...state,
                messages: updatedMessages,
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
                        event: event.type === 'message' ? (data.type || data.event || 'message') : event.type,
                        content: typeof data === 'string' ? data : data.content,
                        data,
                        timestamp: data.timestamp || new Date().toISOString(),
                        sender: data.sender
                    };

                    // Debug logging for device messages
                    if (data.type && data.type.startsWith('device:')) {
                        console.log('[SSE] Received device message:', {
                            eventType: event.type,
                            messageEvent: message.event,
                            dataType: data.type,
                            payload: data.payload,
                            fullData: data
                        });
                    }

                    // Handle connection ID from connected event
                    if (message.event === 'connected' && message.data?.connectionId) {
                        update(state => ({
                            ...state,
                            connectionId: message.data.connectionId
                        }));
                        console.log(`[SSE] Received connection ID: ${message.data.connectionId}`);
                        // Immediately verify the connectionId is set in the store
                        let verifyState: SSEState | null = null;
                        const verifyUnsub = subscribe((s: SSEState) => { verifyState = s; });
                        verifyUnsub();
                        console.log(`[SSE] Store state after connectionId update:`, {
                            connectionId: (verifyState as SSEState | null)?.connectionId,
                            status: (verifyState as SSEState | null)?.status
                        });
                    }

                    // Check if this message is a response to a pending request
                    const requestId = data.requestId || (data.payload?.requestId as string);
                    if (requestId && pendingRequests[requestId]) {
                        console.log(`[SSE] Received response for request: ${requestId}`);
                        console.log(`[SSE] Response data:`, data);

                        // Add detailed logging for screenshot responses
                        if (requestId.startsWith('screenshot-')) {
                            const payload = data?.payload || {};
                            const img = data?.image || payload?.image;
                            const fmt = data?.format || payload?.format;
                            const len = typeof img === 'string' ? img.length : 0;
                            console.log(`[SSE] Screenshot response structure:`, {
                                hasTopLevelImage: !!data.image,
                                hasPayloadImage: !!(data.payload && data.payload.image),
                                payloadType: payload?.type,
                                responseFormat: fmt,
                                imageBase64Length: len
                            });
                        }

                        const { resolve, timer } = pendingRequests[requestId];
                        clearTimeout(timer);
                        delete pendingRequests[requestId];
                        resolve(data);
                    } else {
                        console.log(`[SSE] Received non-request message:`, data);
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
            ['connected', 'webhook', 'notification'].forEach((eventType: string) => {
                if (!eventSource) return;
                const handler = (ev: MessageEvent<any>) => eventSource && eventSource.onmessage && eventSource.onmessage(ev as MessageEvent);
                eventSource.addEventListener(eventType, handler as any);
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
            
            // Function to get the current connection ID from the store
            const getConnectionId = (): string | null => {
                let id: string | null = null;
                const unsub = subscribe(state => { id = state.connectionId; });
                unsub();
                return id;
            };
            
            // Get the current connection ID
            let currentConnectionId = getConnectionId();
            
            // If no connection ID is available, wait for it with a timeout
            if (!currentConnectionId) {
                console.log(`[SSE] No connectionId available when sending request ${requestId}, waiting for connection...`);
                
                // Create a promise that resolves when connectionId is available or rejects after timeout
                const waitForConnectionId = new Promise<string>((resolveId, rejectId) => {
                    // Set a timeout for waiting
                    const waitTimer = setTimeout(() => {
                        if (unsubscribeWait) unsubscribeWait();
                        rejectId(new Error('Timed out waiting for SSE connection ID'));
                    }, Math.min(2000, timeoutMs / 2)); // Wait at most 2 seconds or half the request timeout
                    
                    // Subscribe to the store and wait for connectionId to be set
                    const unsubscribeWait = subscribe(state => {
                        if (state.connectionId) {
                            clearTimeout(waitTimer);
                            unsubscribeWait();
                            resolveId(state.connectionId);
                        }
                    });
                });
                
                // Wait for connection ID or proceed after timeout
                return waitForConnectionId
                    .then(connectionId => {
                        console.log(`[SSE] ConnectionId became available: ${connectionId}`);
                        // Call sendRequest again now that we have a connectionId
                        return sendRequest(partialMsg, timeoutMs, requestIdPrefix);
                    })
                    .catch(error => {
                        console.warn(`[SSE] ${error.message}, proceeding with empty connectionId`);
                        // Continue with the request anyway, using empty connectionId
                        currentConnectionId = getConnectionId(); // Check one more time
                        
                        // Create the message and send it
                        const message = {
                            ...partialMsg,
                            timestamp: new Date().toISOString(),
                            requestId,
                            senderConnectionId: currentConnectionId || ''
                        };
                        
                        console.log(`[SSE] Sending request ${requestId} with senderConnectionId: ${message.senderConnectionId} (after waiting):`, message);
                        
                        // Continue with the regular send flow
                        sendMessage(message, requestId, timeoutMs, resolve, reject);
                        return null; // This return is just to satisfy TypeScript
                    });
            }
            
            // We have a connectionId, proceed normally
            console.log(`[SSE] ConnectionId available: ${currentConnectionId}`);
            
            // Create the full message with timestamp, request ID, and connectionId
            const message = {
                ...partialMsg,
                timestamp: new Date().toISOString(),
                requestId,
                senderConnectionId: currentConnectionId
            };
            
            console.log(`[SSE] Sending request ${requestId} with senderConnectionId: ${message.senderConnectionId}:`, message);
            
            // Send the message using the helper function
            sendMessage(message, requestId, timeoutMs, resolve, reject);
        });
    }
    
    /**
     * Helper function to send a message via POST to the SSE endpoint
     * @param message The complete message to send
     * @param requestId The request ID for tracking
     * @param timeoutMs Timeout in milliseconds
     * @param resolve Promise resolve function
     * @param reject Promise reject function
     */
    function sendMessage(
        message: any,
        requestId: string,
        timeoutMs: number,
        resolve: (value: any) => void,
        reject: (reason: any) => void
    ) {
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
        })
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