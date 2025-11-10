import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { ClientMessage } from './types/messages';
import { generateRequestId } from "$lib/utils/ApiUtils";
    

const WS_URL_PATH = '/websocket';
const BASE_RECONNECT_INTERVAL = 1000;
const MAX_RECONNECT_INTERVAL = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000;

type WebSocketStatus = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'RECONNECTING';

interface WebSocketMessage {
  type: string;
  scope: string;
  payload: Record<string, unknown>;
  data?: any;
  content?: string;
  timestamp?: string;
}

interface WebSocketState {
  status: WebSocketStatus;
  error: Error | null;
  socket: { id?: string; readyState?: number; url?: string } | null;
  messages: WebSocketMessage[];
}

/**
 * Creates a Svelte store that manages a WebSocket connection,
 * handles automatic reconnection, ping/pong keepalive, and provides:
 *  • send(...)         – fire-and-forget
 *  • sendRequest(...)  – request/response with timeout
 *  • on(...)           – event listener
 *  • clearMessages()   – clears stored message history
 *  • connect()         – manually trigger reconnect
 *  • disconnect()      – tear down the connection
 *  • resetConnection() – force-close then reconnect
 *
 * The store’s value ({ status, error, socket, messages }) is reactive,
 * exposing current connection state and message history.
 */
const createSocketStore = () => {
  // If not running in browser (SSR), return a no-op store.
  if (!browser) {
    const { subscribe } = writable<WebSocketState>({
      status: 'CLOSED',
      error: null,
      socket: null,
      messages: []
    });
    return {
      subscribe,
      connect: () => {},
      disconnect: () => {},
      send: (_: unknown) => {},
      sendRequest: async () => { throw new Error('WebSocket not available in SSR'); },
      clearMessages: () => {},
      on: (_: string, __: (data: any) => void) => () => {}
    };
  }

  // ─── Internal reactive state ─────────────────────────────────────────────────

  const { subscribe, set, update } = writable<WebSocketState>({
    status: 'CONNECTING',
    error: null,
    socket: null,
    messages: []
  });

  let socket: WebSocket | null = null;
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let sessionMonitorInterval: ReturnType<typeof setInterval> | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSessionId: string | null = null;
  let allowConnections = true;

  // messageListeners[type] = [ callback1, callback2, ... ]
  const messageListeners: Record<string, ((data: any) => void)[]> = {};

  // pendingRequests[requestId] = { resolve, reject, timer }
  // Used by sendRequest() to match incoming responses by requestId.
  const pendingRequests: Record<
    string,
    {
      resolve: (data: any) => void;
      reject: (err: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  > = {};

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Get the current session ID from cookies
   */
  const getCurrentSessionId = (): string | null => {
    if (!browser) return null;
    const sessionCookie = document.cookie.split('; ').find(row => row.startsWith('auth_session='));
    return sessionCookie ? sessionCookie.split('=')[1] : null;
  };

  /**
   * Check if session has changed and force reconnection if needed
   */
  const checkSessionChange = (): boolean => {
    const currentSessionId = getCurrentSessionId();
    if (lastSessionId && currentSessionId && lastSessionId !== currentSessionId) {
      console.log('[WebSocket] Session changed, forcing reconnection');
      lastSessionId = currentSessionId;
      return true;
    }
    if (!lastSessionId && currentSessionId) {
      lastSessionId = currentSessionId;
    }
    return false;
  };

  /**
   * push a message into the reactive `messages` array.
   * This is called for every inbound or outbound message for debugging/inspection.
   */
  const addMessage = (message: WebSocketMessage) => {
    update(state => ({
      ...state,
      messages: Array.isArray(state.messages) ? [...state.messages, message] : [message]
    }));
  };

  /**
   * Dispatch a message to all listeners registered for its type,
   * and also to any listener registered under 'message' (catch-all).
   */
  const dispatchMessage = (message: WebSocketMessage) => {
    console.log('[WebSocket] ===== DISPATCHING MESSAGE =====');
    console.log('[WebSocket] Message type:', message.type);
    console.log('[WebSocket] Available listeners for type:', Object.keys(messageListeners));
    console.log('[WebSocket] Listeners for this type:', messageListeners[message.type]?.length || 0);
    console.log('[WebSocket] Listeners for "message":', messageListeners['message']?.length || 0);
    
    if (!message.type) {
      console.log('[WebSocket] No message type, skipping dispatch');
      return;
    }

    // First, call any listeners for this exact message.type
    if (messageListeners[message.type]) {
      console.log(`[WebSocket] Calling ${messageListeners[message.type].length} listeners for type "${message.type}"`);
      messageListeners[message.type].forEach(cb => {
        try {
          cb(message.data ?? message);
        } catch (err) {
          console.error(`Listener error [${message.type}]:`, err);
        }
      });
    } else {
      console.log(`[WebSocket] No listeners for type "${message.type}"`);
    }

    // Then, call any listeners registered under 'message' (wildcard)
    if (messageListeners['message']) {
      console.log(`[WebSocket] Calling ${messageListeners['message'].length} listeners for wildcard "message"`);
      messageListeners['message'].forEach(cb => {
        try {
          cb(message);
        } catch (err) {
          console.error(`Listener error [message]:`, err);
        }
      });
    } else {
      console.log('[WebSocket] No wildcard "message" listeners');
    }
  };

  /**
   * Generate a short random string, optionally prefixed.
   * Used to create unique requestIds.
   */
  const makeRequestId = (prefix = ''): string => {
    const random = Math.random().toString(36).substring(2, 10);
    return prefix ? `${prefix}_${random}` : random;
  };

  // ─── Connection Lifecycle ────────────────────────────────────────────────────

  /**
   * Exponential backoff reconnect logic.
   * After a failed connection, waits longer between each attempt.
   */
  const scheduleReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      const error = new Error(`Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      console.error('[WebSocket]', error.message);
      set(state => ({
        ...state,
        status: 'CLOSED',
        error
      }));
      return;
    }

    // Don't try to reconnect if we're already reconnecting
    if (reconnectTimer) {
      return;
    }

    // Calculate delay with jitter to prevent thundering herd problem
    const baseDelay = Math.min(
      BASE_RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_INTERVAL
    );
    const jitter = Math.random() * 1000; // Add up to 1s of jitter
    const delay = Math.floor(baseDelay + jitter);

    reconnectAttempts++;
    const statusMessage = `Reconnecting in ${Math.round(delay/1000)}s... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
    console.log(`[WebSocket] ${statusMessage}`);
    
    set(state => ({
      ...state,
      status: 'RECONNECTING',
      error: new Error(statusMessage)
    }));

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      console.log(`[WebSocket] Attempting to reconnect (attempt ${reconnectAttempts})`);
      connect();
    }, delay);
  };

  const connect = () => {
    // CRITICAL: Check if we're on an auth page - if so, DO NOT connect
    if (browser && window.location.pathname.startsWith('/auth/')) {
      console.log('[WebSocket] On auth page, preventing connection');
      return;
    }

    if (!allowConnections) {
      console.log('[WebSocket] Connections disabled, skipping connect');
      return;
    }

    const baseParams: Record<string, string> = {};
    
    // Close existing socket if any
    if (socket) {
      try {
        // Remove all event listeners to prevent memory leaks
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        
        // Only close if not already in a closing or closed state
        if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Reconnecting...');
        }
      } catch (err) {
        console.error('Error while closing previous socket:', err);
      }
      socket = null;
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Only attempt to reconnect if we haven't exceeded max attempts
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('Max reconnection attempts reached, giving up');
      return;
    }

    // Get session cookie to pass as query parameter (for Pushpin compatibility)
    console.log('[WebSocket] Reading session cookie...');
    console.log('[WebSocket] All cookies:', document.cookie);
    const sessionCookie = document.cookie.split('; ').find(row => row.startsWith('auth_session='));
    console.log('[WebSocket] Session cookie:', sessionCookie);
    const sessionId = sessionCookie ? sessionCookie.split('=')[1] : null;
    console.log('[WebSocket] Extracted session ID:', sessionId ? `${sessionId.substring(0, 10)}...` : 'NOT FOUND');
    
    // Build query params with session if available
    const params = new URLSearchParams(baseParams as Record<string, string>);
    console.log('[WebSocket] Initial query params:', baseParams);
    if (sessionId && !params.has('session')) {
      params.set('session', sessionId);
      console.log('[WebSocket] Added session to query params');
    } else if (!sessionId) {
      console.warn('[WebSocket] No session ID found in cookies!');
    } else if (params.has('session')) {
      console.log('[WebSocket] Session already in query params');
    }
    const queryString = params.toString();
    console.log('[WebSocket] Final query string:', queryString);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${WS_URL_PATH}${queryString ? '?' + queryString : ''}`;
    console.log('[WebSocket] Full URL (with session redacted):', url.replace(/session=[^&]+/, 'session=***'));

    try {
      console.log(`[WebSocket] Connecting to ${url} (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
      socket = new WebSocket(url);
      update(state => ({ ...state, status: 'CONNECTING', error: null }));

      socket.onopen = () => {
        reconnectAttempts = 0;
        const socketId = 'ws-' + Math.random().toString(36).substring(2, 10);
        console.log(`[WebSocket] ✅ Connection opened successfully!`);
        console.log(`[WebSocket] Socket ID: ${socketId}`);
        console.log(`[WebSocket] Ready state: ${socket?.readyState}`);
        
        set({
          status: 'OPEN',
          error: null,
          socket: { id: socketId, readyState: socket!.readyState, url },
          messages: []
        });

        // Start a ping interval to keep the connection alive and monitor session changes
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            // Check for session changes during ping
            if (checkSessionChange()) {
              console.log('[WebSocket] Session changed during ping, forcing reconnection');
              resetConnection(true);
              return;
            }
            
            try {
              socket.send(JSON.stringify({ type: 'ping' }));
            } catch (err) {
              console.error('[WebSocket] Error sending ping:', err);
              // Try to reconnect if ping fails
              scheduleReconnect();
            }
          }
        }, PING_INTERVAL);

        // Start a separate session monitor to catch session changes more frequently
        if (sessionMonitorInterval) clearInterval(sessionMonitorInterval);
        sessionMonitorInterval = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            if (checkSessionChange()) {
              console.log('[WebSocket] Session change detected by monitor, forcing reconnection');
              resetConnection(true);
            }
          }
        }, 5000); // Check every 5 seconds
      };

      socket.onmessage = (event) => {
        try {
          if (!event.data) {
            console.warn('[WebSocket] Received empty message');
            return;
          }

          let message: WebSocketMessage;
          try {
            message = JSON.parse(event.data) as WebSocketMessage;
          } catch (err) {
            console.error('[WebSocket] Error parsing message:', err, 'Raw data:', event.data);
            return;
          }

          // If this message has a payload.requestId that matches a pending request,
          // resolve that promise and do not dispatch further.
          const rid = (message.payload as any)?.requestId as string | undefined;
          if (rid && pendingRequests[rid]) {
            const { resolve, timer, timeout } = pendingRequests[rid];
            clearTimeout(timer);
            clearTimeout(timeout);
            delete pendingRequests[rid];
            return resolve(message.payload);
          }

          // Handle welcome messages (e.g. server may send socketId, userId, role)
          if (message.type === 'welcome') {
            console.log('[WebSocket] Received welcome message:', message);
            update(state => ({
              ...state,
              socket: {
                ...state.socket,
                id: message.payload?.socketId as string || state.socket?.id,
                userId: message.payload?.userId as string,
                role: message.payload?.role as string
              }
            }));
          }

          // Otherwise, treat as a normal event
          console.log('[WebSocket] ===== RECEIVED MESSAGE =====');
          console.log('[WebSocket] Message type:', message.type);
          console.log('[WebSocket] Message scope:', message.scope);
          console.log('[WebSocket] Message payload:', message.payload);
          console.log('[WebSocket] Full message:', message);
          
          addMessage(message);
          dispatchMessage(message);
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };

      socket.onclose = (event) => {
        console.log('[WebSocket] ❌ Connection closed');
        console.log('[WebSocket] Close code:', event.code);
        console.log('[WebSocket] Close reason:', event.reason || 'No reason provided');
        console.log('[WebSocket] Was clean:', event.wasClean);
        
        addMessage({
          type: 'system',
          scope: 'system',
          payload: {
            content: 'Disconnected from WebSocket server',
            reason: event.reason || 'Connection closed',
            code: event.code
          },
          timestamp: new Date().toISOString()
        });
        update(state => ({ ...state, status: 'CLOSED', socket: null }));
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }

        // Update state with close reason
        update(state => ({
          ...state,
          status: 'CLOSED',
          error: event.wasClean 
            ? null 
            : new Error(`Connection closed: ${event.code} ${event.reason || 'No reason provided'}`),
          socket: {
            ...state.socket,
            readyState: socket?.readyState
          }
        }));

        // Don't try to reconnect if this was a clean close (e.g., logout)
        if (event.code === 1000) {
          console.log('[WebSocket] Clean close (1000), not reconnecting');
          return;
        }
        
        if (event.code === 1008) {
          console.error('[WebSocket] Auth failure (1008):', event.reason);
        }

        // Attempt exponential-backoff reconnect up to MAX_RECONNECT_ATTEMPTS
        console.log('[WebSocket] Will attempt to reconnect...');
        scheduleReconnect();
      };

      socket.onerror = (event) => {
        // Get the error message from the event if possible
        const errorMessage = event instanceof ErrorEvent 
          ? event.message 
          : 'WebSocket connection error';
          
        console.error('[WebSocket] Connection error:', errorMessage);
        
        update(state => ({
          ...state,
          status: 'CLOSED',
          error: new Error(errorMessage),
          socket: {
            ...state.socket,
            readyState: socket?.readyState
          }
        }));

        // Schedule a reconnect on error
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          scheduleReconnect();
        }
      };
    } catch (err) {
      set({
        status: 'CLOSED',
        error: err instanceof Error ? err : new Error('Failed to connect to WebSocket server'),
        socket: null,
        messages: [{
          type: 'error',
          scope: 'system',
          payload: {
            content: 'Failed to connect to WebSocket server',
            message: (err as Error).message || 'unknown',
            timestamp: new Date().toISOString()
          }
        }]
      });
    }
  };

  /**
   * Gracefully close the WebSocket connection,
   * clear ping interval, session monitor, any reconnect timers, and reject pending requests.
   */
  const disconnect = () => {
    if (socket) {
      socket.close();
      socket = null;
    }
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (sessionMonitorInterval) {
      clearInterval(sessionMonitorInterval);
      sessionMonitorInterval = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = 0;

    // Reject all in-flight requests
    Object.values(pendingRequests).forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error('WebSocket disconnected before response'));
    });
    Object.keys(pendingRequests).forEach(rid => delete pendingRequests[rid]);

    set({
      status: 'CLOSED',
      error: null,
      socket: null,
      messages: []
    });
  };

  // ─── Fire-and-forget send ─────────────────────────────────────────────────────

  /**
   * send:
   *  • If socket is open, immediately send the provided message over WebSocket.
   *  • If socket is closed, attempt to reconnect and retry once after 1s.
   *  • Adds the sent message into `messages` array for inspection/logging.
   *
   * eventOrMessage can be either:
   *  • a full ClientMessage object, or
   *  • a string – in which case we wrap it:
   *      { type: eventOrMessage, scope: 'system', payload: data || {}, timestamp: now }
   */
  const send = (eventOrMessage: string | ClientMessage, data?: any) => {
    console.log('[WebSocket] Send', eventOrMessage);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        // Force a reconnect, then retry after 1 second
        connect('');
        setTimeout(() => send(eventOrMessage, data), 1000);
      }
      console.log("[WebSocket] Sending data", data);
      return;
    }

    const message: ClientMessage = typeof eventOrMessage === 'object'
      ? eventOrMessage
      : {
          type: eventOrMessage,
          scope: 'system',
          payload: data || {},
          timestamp: new Date().toISOString()
        };

    try {
      console.log("[WebSocket] Sending data", message);
      socket.send(JSON.stringify(message));
      addMessage({
        type: message.type,
        scope: message.scope,
        payload: message.payload,
        timestamp: message.timestamp
      });
    } catch (err) {
      console.error('Send error:', err);
    }
  };

  // ─── Request/Response with timeout ───────────────────────────────────────────

  /**
   * sendRequest:
   *  • Accepts partialMsg: { type, scope, payload }.
   *  • Automatically generates:
   *       – payload.requestId (unique via makeRequestId(prefix))
   *       – timestamp (current ISO string)
   *  • Returns a Promise that:
   *       – resolves when an incoming message has payload.requestId matching ours,
   *       – rejects if no response arrives within `timeoutMs`.
   *
   * Usage:
   *   const response = await socketStore.sendRequest(
   *     {
   *       type: 'device',
   *       scope: 'subscription:device:123',
   *       payload: { action: 'message', type: 'ping', deviceId: '123' }
   *     },
   *     /* timeoutMs= *\/ 5000,
   *     /* requestIdPrefix= *\/ 'ping'
   *   );
   *
   * If the socket is not OPEN, immediately rejects.
   */
  function sendRequest(
    partialMsg: { type: string; scope: string; payload: Record<string, any>; requestId?: string },
    timeoutMs = 5000,
    requestIdPrefix = ''
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not open'));
      }

      // 1) Create a unique requestId (optionally prefixed) if not provided
      const requestId = partialMsg.requestId || generateRequestId(requestIdPrefix);

      // 2) Build the full message with requestId as a first-class property
      const fullMessage: ClientMessage = {
        type: partialMsg.type,
        scope: partialMsg.scope,
        payload: partialMsg.payload,
        requestId,
        timestamp: new Date().toISOString()
      };

      console.log(`Sending request ${JSON.stringify(fullMessage)}`);

      // 3) Start a timer to reject if no response arrives
      const timer = setTimeout(() => {
        delete pendingRequests[requestId];
        reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // 4) Store resolve/reject + timer so that onmessage can clear them
      pendingRequests[requestId] = { resolve, reject, timer };

      // 5) Finally, send the message
      try {
        socket!.send(JSON.stringify(fullMessage));
        addMessage({
          type: fullMessage.type,
          scope: fullMessage.scope,
          payload: fullMessage.payload,
          timestamp: fullMessage.timestamp
        });
      } catch (err) {
        clearTimeout(timer);
        delete pendingRequests[requestId];
        return reject(new Error('WebSocket send error: ' + (err as Error).message));
      }
    });
  }

  /**
   * clearMessages:
   *  • Clears the entire array of stored WebSocket messages.
   *  • Does NOT close the socket or affect pending requests.
   */
  const clearMessages = () => update(state => ({ ...state, messages: [] }));

  /**
   * on(event, callback):
   *  • Register a callback for any incoming message whose `type === event`.
   *  • The callback receives either message.data (if present) or the full message.
   *  • Returns an unsubscribe function.
   *
   *  Example:
   *    const off = socketStore.on('deviceUpdate', data => { … });
   *    // Later: off();
   */
  const on = (event: string, callback: (data: any) => void) => {
    if (!messageListeners[event]) {
      messageListeners[event] = [];
    }
    messageListeners[event].push(callback);
    return () => {
      messageListeners[event] = messageListeners[event].filter(cb => cb !== callback);
      if (messageListeners[event].length === 0) {
        delete messageListeners[event];
      }
    };
  };

  /**
   * getStatus:
   *  • Returns the current WebSocket status (CONNECTING | OPEN | ...).
   *  • Useful for synchronous checks, e.g. if (socketStore.status === 'OPEN') { … }
   */
  const getStatus = (): WebSocketStatus => {
    let current: WebSocketStatus = 'CLOSED';
    const unsubscribe = subscribe(state => {
      current = state.status;
    });
    unsubscribe();
    return current;
  };

  /**
   * Forcefully close the current connection (if any) and establish a new one.
   * This is useful when you need to force a fresh connection, such as after authentication.
   * @param immediate - If true, will reconnect immediately. If false, will use the normal backoff strategy.
   */
  const resetConnection = (immediate = false) => {
    console.log(`[WebSocket] Resetting connection${immediate ? ' (immediate)' : ' (with backoff)'}`);
    
    // Reset session tracking
    lastSessionId = getCurrentSessionId();
    
    // Reset reconnection attempts if we're forcing a reset
    if (immediate) {
      reconnectAttempts = 0;
    }
    
    // Close any existing connection
    disconnect();
    
    // Clear any pending reconnection timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // If immediate, connect right away, otherwise let the normal reconnection logic handle it
    if (immediate) {
      console.log('[WebSocket] Reconnecting immediately');
      connect();
    } else {
      console.log('[WebSocket] Will reconnect using backoff strategy');
      scheduleReconnect();
    }
  };

  /**
   * Force disconnect and reconnect with fresh session credentials
   * This should be called when user authentication changes
   */
  const resetForNewUser = () => {
    console.log('[WebSocket] Resetting connection for new user');
    
    // Clear session tracking to force refresh
    lastSessionId = null;
    
    // Force immediate reset with fresh connection
    resetConnection(true);
  };

  const setAuthEnabled = (enabled: boolean) => {
    allowConnections = enabled;
    if (!enabled) {
      console.log('[WebSocket] Disabling connections due to auth state');
      disconnect();
    }
  };

  // NOTE: Do NOT auto-connect here. Connection lifecycle is managed by AuthStateHandler
  // to ensure proper session handling and prevent multiple connections.
  // connect();

  return {
    subscribe,
    connect,
    disconnect,
    /**
     * Fire-and-forget send:
     *   socketStore.send({ type, scope, payload, timestamp })
     */
    send,
    /**
     * Request/response send:
     *   const reply = await socketStore.sendRequest({ type, scope, payload });
     */
    sendRequest,
    clearMessages,
    on,
    get status() {
      return getStatus();
    },
    resetConnection,
    resetForNewUser,
    setAuthEnabled
  };
};

export const socketStore = createSocketStore();

/**
 * Convenience helper to register a listener:
 *   onSocketEvent('someType', data => { … });
 */
export const onSocketEvent = (event: string, callback: (data: any) => void) =>
  socketStore.on(event, callback);
