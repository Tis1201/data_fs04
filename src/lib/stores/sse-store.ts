import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { generateRequestId } from "$lib/utils/ApiUtils";

type SSEAuthListener = (enabled: boolean) => void;

const sseAuthListeners = new Set<SSEAuthListener>();
let sseGlobalAuthEnabled = true;

function registerSSEAuthListener(listener: SSEAuthListener) {
    sseAuthListeners.add(listener);
    listener(sseGlobalAuthEnabled);
    return () => {
        sseAuthListeners.delete(listener);
    };
}

function broadcastSSEAuthEnabled(enabled: boolean) {
    if (sseGlobalAuthEnabled === enabled) {
        return;
    }

    sseGlobalAuthEnabled = enabled;
    sseAuthListeners.forEach((cb) => {
        try {
            cb(enabled);
        } catch (err) {
            console.error('[SSE] Auth listener error:', err);
        }
    });
}


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
    let allowConnections = true;
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
        // Enhanced logging for device messages
        if (message.event === 'device:connection' || message.event === 'device:disconnection' || 
            (message.data?.type && (message.data.type === 'device:connection' || message.data.type === 'device:disconnection'))) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[SSE] 📬 addMessage() called for device event:', {
                messageEvent: message.event,
                dataType: message.data?.type,
                deviceId: message.data?.payload?.deviceId || message.data?.deviceId,
                connected: message.data?.payload?.connected || message.data?.connected,
                registeredListeners: {
                    specific: messageListeners[message.event]?.length || 0,
                    wildcard: messageListeners['*']?.length || 0
                }
            });
        }
        
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
        
        if (message.event === 'device:connection' || message.event === 'device:disconnection' || 
            (message.data?.type && (message.data.type === 'device:connection' || message.data.type === 'device:disconnection'))) {
            console.log('[SSE] 📢 Notifying listeners:', {
                totalListeners: listeners.length,
                specificListeners: messageListeners[message.event]?.length || 0,
                wildcardListeners: messageListeners['*']?.length || 0
            });
        }
        
        listeners.forEach((cb, index) => {
            try {
                if (message.event === 'device:connection' || message.event === 'device:disconnection' || 
                    (message.data?.type && (message.data.type === 'device:connection' || message.data.type === 'device:disconnection'))) {
                    console.log(`[SSE] 📞 Calling listener ${index + 1}/${listeners.length}`);
                }
                cb(message);
            } catch (err) {
                console.error(`SSE listener error [${message.event}]:`, err);
            }
        });
        
        if (message.event === 'device:connection' || message.event === 'device:disconnection' || 
            (message.data?.type && (message.data.type === 'device:connection' || message.data.type === 'device:disconnection'))) {
            console.log('[SSE] ✅ All listeners notified');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
    };

    /**
     * Connect to an SSE endpoint
     */
    function connect(url: string, options: { withCredentials?: boolean } = {}) {
        if (!browser) return;

        // CRITICAL: Check if we're on an auth page - if so, DO NOT connect
        if (window.location.pathname.startsWith('/auth/')) {
            console.log('[SSE] On auth page, preventing connection');
            return;
        }

        if (!allowConnections) {
            console.log('[SSE] Connections disabled, preventing SSE connect');
            return;
        }
        
        // Prevent duplicate connections (idempotent)
        if (eventSource?.readyState === EventSource.OPEN) {
            console.log('[SSE] Already connected, reusing existing connection');
            return;
        }
        
        if (eventSource?.readyState === EventSource.CONNECTING) {
            console.log('[SSE] Connection in progress, waiting...');
            return;
        }

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
                console.log('[SSE] EventSource readyState:', eventSource?.readyState);
                console.log('[SSE] EventSource URL:', eventSource?.url);
                update(state => ({
                    ...state,
                    status: 'OPEN',
                    error: null
                }));
            };

            // Helper function to process SSE messages (used by both onmessage and custom event listeners)
            const processSSEMessage = (event: MessageEvent) => {
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

                    // Enhanced logging for ALL device messages
                    if (data.type && (data.type.startsWith('device:') || data.type === 'device:connection' || data.type === 'device:disconnection')) {
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        console.log('[SSE] 📨 DEVICE MESSAGE RECEIVED:', {
                            rawEventType: event.type,
                            parsedEventType: message.event,
                            dataType: data.type,
                            hasPayload: !!data.payload,
                            payloadKeys: data.payload ? Object.keys(data.payload) : [],
                            deviceId: data.payload?.deviceId || data.deviceId,
                            connected: data.payload?.connected || data.connected,
                            fullData: data
                        });
                        console.log('[SSE] Full parsed message object:', message);
                        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
                    console.log(`[SSE] Checking for pending request. requestId: ${requestId}, hasPending: ${!!requestId && !!pendingRequests[requestId]}`);
                    console.log(`[SSE] Pending requests:`, Object.keys(pendingRequests));
                    console.log(`[SSE] Message data keys:`, Object.keys(data));
                    console.log(`[SSE] Full data:`, data);
                    
                    if (requestId && pendingRequests[requestId]) {
                        console.log(`[SSE] ✅ Received response for request: ${requestId}`);
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
                        // Log when message doesn't match any pending request
                        if (requestId) {
                            console.warn(`[SSE] ⚠️ Message has requestId ${requestId} but no matching pending request`);
                        }
                        
                        // Log all non-request messages for debugging
                        if (data.type === 'device:connection' || data.type === 'device:disconnection') {
                            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                            console.log(`[SSE] 📨 NON-REQUEST DEVICE MESSAGE:`, {
                                type: data.type,
                                payload: data.payload,
                                fullData: data,
                                messageEvent: message.event
                            });
                            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                        } else {
                            console.log(`[SSE] Received non-request message:`, {
                                type: data.type,
                                event: message.event,
                                hasPayload: !!data.payload,
                                dataKeys: Object.keys(data)
                            });
                        }
                    }

                    addMessage(message);
                } catch (err) {
                    console.error('[SSE] Error processing message:', err, 'Raw data:', event.data);
                }
            };

            // Use the same handler for default 'message' events
            eventSource.onmessage = processSSEMessage;
            
            // CRITICAL: Add listeners for custom SSE event types
            // Custom event types are NOT caught by onmessage, they require explicit addEventListener
            // EventSource matches event types EXACTLY, not by prefix (e.g., 'device' won't catch 'device:connection')
            
            const customEventTypes = [
                'device',                  // Claim responses
                'device:connection',       // Device online
                'device:disconnection',    // Device offline
                'device:actionRequest',    // Action sent to device
                'device:statusUpdate',     // Device status update
                'device:dataUpdate',       // Device data update
                'device:profileUpdate',    // Device profile update
                'device:progressUpdate',   // Device progress updates
                'device:pullFileStatus',   // Pull file status updates
                'device:pushFileStatus',   // Push file status updates
                'device:getLogsStatus',    // Get logs status updates
                'bundle:waveStatus',       // Bundle wave status
                'bundle:status',           // Bundle status
                'terminal',                // Terminal responses (connect, input, resize, etc.)
                'terminal:output',         // Terminal output from device
                'terminal:error',          // Terminal errors
                'rdp',                     // RDP responses (start, stop, mouse, keyboard)
                'rdp:error',               // RDP errors
                'whatsapp',                // WhatsApp messages (QR codes, connection status, etc.)
                'room',                    // Room messages (create, join, leave, list, etc.)
            ];
            
            customEventTypes.forEach(eventType => {
                eventSource?.addEventListener(eventType, (event) => {
                    console.log(`[SSE] 🎯 Received custom "${eventType}" event:`, event);
                    processSSEMessage(event);
                });
            });
            console.log(`[SSE] ✅ Added event listeners for ${customEventTypes.length} custom event types:`, customEventTypes);

            eventSource.onerror = (event) => {
                console.error('[SSE] Connection error:', event);
                console.error('[SSE] EventSource readyState:', eventSource?.readyState);
                console.error('[SSE] EventSource URL:', eventSource?.url);
                
                update(state => ({
                    ...state,
                    status: 'ERROR',
                    error: new Error('SSE connection error')
                }));
                
                // Note: The browser will automatically attempt to reconnect
            };

            // Set up specific event listeners for custom event types
            // This includes device events that are sent with custom SSE event types
            // Note: processSSEMessage is already defined above and used by onmessage
            [
                'connected', 
                'webhook', 
                'notification', 
                'device:connection', 
                'device:disconnection',
                'device:actionRequest',
                'device:statusUpdate',
                'device:dataUpdate',
                'device:progressUpdate',
                'device:profileUpdate'
            ].forEach((eventType: string) => {
                if (!eventSource) return;
                eventSource.addEventListener(eventType, processSSEMessage as any);
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
     * Force disconnect and reconnect with fresh session credentials
     * This should be called when user authentication changes
     */
    function resetForNewUser() {
        console.log('[SSE] Resetting connection for new user');
        disconnect();
        
        // Clear any cached connection state
        set({
            status: 'CLOSED',
            error: null,
            lastEvent: null,
            connectionId: null,
            messages: []
        });
        
        // Clear all pending requests
        Object.values(pendingRequests).forEach(({ reject, timer }) => {
            clearTimeout(timer);
            reject(new Error('SSE connection reset for new user'));
        });
        Object.keys(pendingRequests).forEach(rid => delete pendingRequests[rid]);
        
        console.log('[SSE] Connection reset completed');
    }

    function setAuthEnabled(enabled: boolean) {
        broadcastSSEAuthEnabled(enabled);
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
        /**
         * Send a message without waiting for a response (fire-and-forget)
         * Useful for WebRTC signaling messages that don't need responses
         */
        sendMessageWithoutResponse: (partialMsg: { type: string; scope: string; payload: Record<string, any>; requestId?: string }) => {
            if (!browser) return Promise.resolve();
            
            const getConnectionId = (): string | null => {
                let id: string | null = null;
                const unsub = subscribe(state => { id = state.connectionId; });
                unsub();
                return id;
            };
            
            const connectionId = getConnectionId();
            const requestId = partialMsg.requestId || generateRequestId('');
            
            const message = {
                ...partialMsg,
                timestamp: new Date().toISOString(),
                requestId,
                senderConnectionId: connectionId || ''
            };
            
            // Send via POST but don't wait for SSE response
            return fetch('/api/sse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message),
                credentials: 'include'
            }).then(response => {
                if (!response.ok) {
                    return response.json().then(errorData => {
                        throw new Error(`SSE message failed: ${errorData.error || response.statusText}`);
                    });
                }
                return response.json(); // Return the HTTP response, don't wait for SSE event
            });
        },
        resetForNewUser,
        setAuthEnabled,
        destroy: registerSSEAuthListener((enabled) => {
            allowConnections = enabled;
            if (!enabled) {
                console.log('[SSE] Disabling connections due to auth state');
                disconnect();
            }
        }),
        
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

// Create a singleton instance (for backward compatibility)
export const sseStore = createSSEStore();

/**
 * Create a per-component SSE store
 * 
 * ⚠️ **WARNING: USE WITH CAUTION!** ⚠️
 * 
 * In 99% of cases, you should use the global `sseStore` instead!
 * This function creates DUPLICATE SSE connections which can cause:
 * - Memory leaks (subscriber count increasing on page reload)
 * - Race conditions and stale connection IDs
 * - Unnecessary server load (1 connection per component vs 1 per user)
 * - Conflicts with AuthStateHandler's global connection
 * 
 * **When to use the GLOBAL store (recommended):**
 * ```typescript
 * import { sseStore } from "$lib/stores/sse-store";
 * // AuthStateHandler manages the connection
 * // Just subscribe to channels you need
 * sseStore.on('connected', (msg) => {
 *     // Subscribe to your channel
 * });
 * ```
 * 
 * **ONLY use createComponentSSE() for these rare cases:**
 * 1. Standalone widgets/embeds in external sites (iframes)
 * 2. Multi-tenant admin tools monitoring different tenants simultaneously
 * 3. Isolated testing/development environments
 * 4. Background workers that need separate connections
 * 
 * **DO NOT use for normal page components!**
 * 
 * @example
 * ```typescript
 * // ❌ WRONG - Creates duplicate connections
 * const mySSE = createComponentSSE();
 * onMount(() => mySSE.connect('/api/sse'));
 * 
 * // ✅ CORRECT - Use global store
 * import { sseStore } from "$lib/stores/sse-store";
 * // Connection managed by AuthStateHandler
 * ```
 * 
 * @deprecated Consider using global `sseStore` instead
 */
export function createComponentSSE() {
    console.warn(
        '[SSE] createComponentSSE() called - Consider using global sseStore instead to avoid duplicate connections. ' +
        'See documentation for valid use cases.'
    );
    return createSSEStore();
}

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

