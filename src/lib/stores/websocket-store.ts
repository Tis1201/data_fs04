import { browser } from '$app/environment';
import { writable } from 'svelte/store';

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

const createSocketStore = () => {
  // Return no-op store if not in browser.
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
      send: () => {},
      clearMessages: () => {},
      on: () => () => {}
    };
  }

  // Internal state and reactive store.
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
  const messageListeners: Record<string, ((data: any) => void)[]> = {};

  // Append a message to the store.
  const addMessage = (message: WebSocketMessage) => {
    update(state => ({ ...state, messages: [...state.messages, message] }));
  };

  // Dispatch messages to registered listeners.
  const dispatchMessage = (message: WebSocketMessage) => {
    if (!message?.type) return;
    messageListeners[message.type]?.forEach(cb => {
      try { cb(message.data || message); } catch (error) { console.error(`Listener error [${message.type}]:`, error); }
    });
    messageListeners['message']?.forEach(cb => {
      try { cb(message); } catch (error) { console.error('Listener error [message]:', error); }
    });
  };

  // Establish a WebSocket connection.
  const connect = (queryParams = '') => {
    // Close any existing connection.
    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${WS_URL_PATH}${queryParams ? '?' + queryParams : ''}`;

    try {
      socket = new WebSocket(url);
      update(state => ({ ...state, status: 'CONNECTING', error: null }));

      socket.onopen = () => {
        reconnectAttempts = 0;
        const socketId = 'ws-' + Math.random().toString(36).substring(2, 10);
        set({ status: 'OPEN', error: null, socket: { id: socketId, readyState: socket!.readyState, url }, messages: [] });
        // addMessage({ type: 'system', content: 'Connected to WebSocket server', data: { timestamp: new Date().toISOString(), socketId } });
        // socket!.send(JSON.stringify({ type: 'register', data: { clientType: 'web' } }));
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'echo' && message.data?.type === 'ping') return;
          if (message.type === 'welcome') {
            update(state => ({
              ...state,
              socket: { 
                ...state.socket, 
                id: message.data?.socketId || state.socket?.id, 
                userId: message.data?.userId, 
                role: message.data?.role 
              }
            }));
          }
          addMessage(message);
          dispatchMessage(message);
        } catch (error) {
          console.error('Message parse error:', error);
        }
      };

      socket.onclose = (event) => {
        addMessage({ type: 'system', content: 'Disconnected from WebSocket server', data: { timestamp: new Date().toISOString(), reason: event.reason || 'Connection closed', code: event.code } });
        update(state => ({ ...state, status: 'CLOSED', socket: null }));
        if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
        // Exponential backoff reconnection.
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const backoffTime = Math.min(BASE_RECONNECT_INTERVAL * Math.pow(2, reconnectAttempts - 1) + Math.random() * 1000, MAX_RECONNECT_INTERVAL);
          reconnectTimer = setTimeout(() => {
            update(state => ({ ...state, status: 'RECONNECTING' }));
            connect(queryParams);
          }, backoffTime);
        } else {
          update(state => ({ ...state, error: new Error('Maximum reconnection attempts reached') }));
        }
      };

      socket.onerror = () => {
        addMessage({ type: 'error', content: 'WebSocket error', data: { timestamp: new Date().toISOString(), message: 'Connection error' } });
        update(state => ({ ...state, error: new Error('WebSocket connection error') }));
      };
    } catch (error) {
      set({
        status: 'CLOSED',
        error: error instanceof Error ? error : new Error('Failed to connect to WebSocket server'),
        socket: null,
        messages: [{
          type: 'error',
          content: 'Failed to connect to WebSocket server',
          data: { timestamp: new Date().toISOString(), message: error?.message || 'Connection failed' }
        }]
      });
    }
  };

  // Cleanly disconnect the WebSocket.
  const disconnect = () => {
    if (socket) { socket.close(); socket = null; }
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    reconnectAttempts = 0;
    set({ status: 'CLOSED', error: null, socket: null, messages: [] });
  };

  // Send a message; if not connected, attempt reconnect and resend.
  const send = (eventOrMessage: string | WebSocketMessage, data?: any) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      if (!socket || socket.readyState === WebSocket.CLOSED) {
        connect('');
        setTimeout(() => send(eventOrMessage, data), 1000);
      }
      return;
    }
    const message: WebSocketMessage = typeof eventOrMessage === 'object'
      ? eventOrMessage
      : { type: eventOrMessage, data: data || {}, timestamp: new Date().toISOString() };
    try {
      socket.send(JSON.stringify(message));
      addMessage({ ...message, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  const clearMessages = () => update(state => ({ ...state, messages: [] }));

  // Register a listener for specific events.
  const on = (event: string, callback: (data: any) => void) => {
    if (!messageListeners[event]) messageListeners[event] = [];
    messageListeners[event].push(callback);
    return () => {
      messageListeners[event] = messageListeners[event].filter(cb => cb !== callback);
      if (!messageListeners[event].length) delete messageListeners[event];
    };
  };

  // Retrieve the current status.
  const getStatus = () => {
    let currentStatus: WebSocketStatus = 'CLOSED';
    const unsubscribe = subscribe(state => { currentStatus = state.status; });
    unsubscribe();
    return currentStatus;
  };

  // Auto-connect on initialization.
  connect();

  return {
    subscribe,
    connect,
    disconnect,
    send,
    clearMessages,
    on,
    get status() {
      return getStatus();
    }
  };
};

export const socketStore = createSocketStore();
export const onSocketEvent = (event: string, callback: (data: any) => void) => socketStore.on(event, callback);
