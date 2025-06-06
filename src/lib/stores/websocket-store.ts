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
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
   * push a message into the reactive `messages` array.
   * This is called for every inbound or outbound message for debugging/inspection.
   */
  const addMessage = (message: WebSocketMessage) => {
    update(state => ({
      ...state,
      messages: [...state.messages, message]
    }));
  };

  /**
   * Dispatch a message to all listeners registered for its type,
   * and also to any listener registered under 'message' (catch-all).
   */
  const dispatchMessage = (message: WebSocketMessage) => {
    if (!message.type) return;

    // First, call any listeners for this exact message.type
    messageListeners[message.type]?.forEach(cb => {
      try {
        cb(message.data ?? message);
      } catch (err) {
        console.error(`Listener error [${message.type}]:`, err);
      }
    });

    // Then, call any listeners registered under 'message' (wildcard)
    messageListeners['message']?.forEach(cb => {
      try {
        cb(message);
      } catch (err) {
        console.error(`Listener error [message]:`, err);
      }
    });
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
   * Establish a WebSocket connection to ws(s)://<host><WS_URL_PATH>[?queryParams].
   * Sets up event handlers for open, message, close, error.
   * On close, will attempt exponential-backoff reconnect up to MAX_RECONNECT_ATTEMPTS.
   */
  const connect = (queryParams = '') => {
    // If already have a socket that isn't fully closed, close it first
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${WS_URL_PATH}${queryParams ? '?' + queryParams : ''}`;

    try {
      socket = new WebSocket(url);
      update(state => ({ ...state, status: 'CONNECTING', error: null }));

      socket.onopen = () => {
        reconnectAttempts = 0;
        const socketId = 'ws-' + Math.random().toString(36).substring(2, 10);
        set({
          status: 'OPEN',
          error: null,
          socket: { id: socketId, readyState: socket!.readyState, url },
          messages: []
        });

        // Start a ping interval to keep the connection alive
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;

          // If this message has a payload.requestId that matches a pending request,
          // resolve that promise and do not dispatch further.
          const rid = (message.payload as any)?.requestId as string | undefined;
          if (rid && pendingRequests[rid]) {
            const { resolve, timer } = pendingRequests[rid];
            clearTimeout(timer);
            delete pendingRequests[rid];
            return resolve(message.payload);
          }

          // Handle welcome messages (e.g. server may send socketId, userId, role)
          if (message.type === 'welcome') {
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
          addMessage(message);
          dispatchMessage(message);
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };

      socket.onclose = (event) => {
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

        // Don't attempt to reconnect for authentication failures (code 1008)
        if (event.code === 1008) {
          console.log('WebSocket closed due to authentication failure. Not attempting to reconnect.');
          update(state => ({ 
            ...state, 
            error: new Error(`Authentication failed: ${event.reason || 'Session invalid or expired'}`)
          }));
          return;
        }

        // Attempt exponential-backoff reconnect up to MAX_RECONNECT_ATTEMPTS
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const backoffTime = Math.min(
            BASE_RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts - 1) + Math.random() * 1000,
            MAX_RECONNECT_INTERVAL
          );
          reconnectTimer = setTimeout(() => {
            update(state => ({ ...state, status: 'RECONNECTING' }));
            connect(queryParams);
          }, backoffTime);
        } else {
          update(state => ({ ...state, error: new Error('Maximum reconnection attempts reached') }));
        }
      };

      socket.onerror = () => {
        addMessage({
          type: 'error',
          scope: 'system',
          payload: {
            content: 'WebSocket error',
            message: 'Connection error',
            timestamp: new Date().toISOString()
          }
        });
        update(state => ({ ...state, error: new Error('WebSocket connection error') }));
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
   * clear ping interval, any reconnect timers, and reject pending requests.
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
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        // Force a reconnect, then retry after 1 second
        connect('');
        setTimeout(() => send(eventOrMessage, data), 1000);
      }
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
    partialMsg: { type: string; scope: string; payload: Record<string, any> },
    timeoutMs = 5000,
    requestIdPrefix = ''
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket is not open'));
      }

      // 1) Create a unique requestId (optionally prefixed)
      const requestId = generateRequestId(requestIdPrefix);

      // 2) Build the full message:
      //    • attach payload.requestId
      //    • attach timestamp
      const fullMessage: ClientMessage = {
        type: partialMsg.type,
        scope: partialMsg.scope,
        payload: { ...partialMsg.payload, requestId },
        timestamp: new Date().toISOString()
      };

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
   * resetConnection:
   *  • Forcefully close any existing socket, clear intervals/timers,
   *    then reconnect after a brief delay.
   *  • Useful when user logs out or authentication changes, so you want
   *    to re-establish with new credentials.
   */
  const resetConnection = () => {
    console.log('Resetting WebSocket connection');
    disconnect();
    // Small delay to ensure clean disconnect before reconnecting
    setTimeout(() => connect(), 100);
  };

  // Automatically connect on store initialization
  connect();

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
    resetConnection
  };
};

export const socketStore = createSocketStore();

/**
 * Convenience helper to register a listener:
 *   onSocketEvent('someType', data => { … });
 */
export const onSocketEvent = (event: string, callback: (data: any) => void) =>
  socketStore.on(event, callback);
