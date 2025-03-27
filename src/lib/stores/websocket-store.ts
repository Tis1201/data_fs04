import { browser } from '$app/environment';
import { writable } from 'svelte/store';

// Constants
const WS_URL_PATH = '/websocket';
const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000; // 30 seconds

// Types
type WebSocketStatus = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' | 'RECONNECTING';

interface WebSocketMessage {
  type: string;
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

// --- Socket Store ---

const createSocketStore = () => {
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
  
  const { subscribe, set, update } = writable<WebSocketState>({
    status: 'CONNECTING',
    error: null,
    socket: null,
    messages: []
  });
  
  // Message listeners
  const messageListeners: Record<string, ((data: any) => void)[]> = {};
  
  // Helper to add a message to the store
  const addMessage = (message: WebSocketMessage) => {
    update(state => ({ ...state, messages: [...(state.messages || []), message] }));
  };
  
  // Dispatch message to registered listeners
  const dispatchMessage = (message: WebSocketMessage) => {
    if (!message?.type) return;
    const type = message.type;
    const data = message.data || message;
    messageListeners[type]?.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`[SocketStore] Error in ${type} listener:`, error);
      }
    });
    messageListeners['message']?.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[SocketStore] Error in message listener:', error);
      }
    });
  };
  
  // Connect to the WebSocket
  const connect = (queryParams = '') => {
    console.log('[SocketStore] Connecting...');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${WS_URL_PATH}${queryParams ? '?' + queryParams : ''}`;
    console.log(`[SocketStore] Connecting to ${url}`);
    try {
      const ws = new WebSocket(url);
      socket = ws;
      
      ws.onopen = () => {
        console.log('[SocketStore] WebSocket opened');
        const socketId = 'ws-' + Math.random().toString(36).substring(2, 10);
        set({
          status: 'OPEN',
          error: null,
          socket: { id: socketId, readyState: ws.readyState, url },
          messages: []
        });
        addMessage({
          type: 'system',
          content: 'Connected to WebSocket server',
          data: { timestamp: new Date().toISOString(), socketId }
        });
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, PING_INTERVAL);
      };
        ws.onmessage = (event) => {
        console.log('[SocketStore] Received:', event.data);
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'echo' && message.data.type === 'ping') {
            console.log('[SocketStore] Ignoring ping');
            return;
          }

          addMessage(message);
          dispatchMessage(message);
        } catch (error) {
          console.error('[SocketStore] Error parsing message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('[SocketStore] WebSocket closed', event);
        addMessage({
          type: 'system',
          content: 'Disconnected from WebSocket server',
          data: { timestamp: new Date().toISOString(), reason: event.reason || 'Connection closed', code: event.code }
        });
        set({ status: 'CLOSED', error: null, socket: null, messages: [] });
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
      };
      
      ws.onerror = (event) => {
        console.error('[SocketStore] WebSocket error', event);
        addMessage({
          type: 'error',
          content: 'WebSocket error',
          data: { timestamp: new Date().toISOString(), message: 'Connection error' }
        });
        update(state => ({ ...state, error: new Error('WebSocket connection error') }));
      };
    } catch (error) {
      console.error('[SocketStore] Connection error:', error);
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
  
  // Disconnect from WebSocket
  const disconnect = () => {
    console.log('[SocketStore] Disconnecting...');
    if (socket) {
      if (socket instanceof WebSocket) {
        socket.close();
      }
      socket = null;
    }
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    set({ status: 'CLOSED', error: null, socket: null, messages: [] });
  };
  
  // Send a message through the WebSocket
  const send = (eventOrMessage: string | WebSocketMessage, data?: any) => {
    if (!socket) {
      console.error('[SocketStore] Cannot send: Socket not connected');
      return;
    }
    let message: WebSocketMessage;
    if (typeof eventOrMessage === 'object') {
      message = eventOrMessage;
    } else {
      message = { type: eventOrMessage, data: data || {}, timestamp: new Date().toISOString() };
    }
    console.log('[SocketStore] Sending:', message);
    socket.send(JSON.stringify(message));
    addMessage({ ...message, timestamp: new Date().toISOString() });
  };
  
  const clearMessages = () => {
    update(state => ({ ...state, messages: [] }));
  };
  
  const on = (event: string, callback: (data: any) => void) => {
    console.log(`[SocketStore] Registering listener for ${event} events`);
    if (!messageListeners[event]) messageListeners[event] = [];
    messageListeners[event].push(callback);
    return () => {
      messageListeners[event] = messageListeners[event].filter(cb => cb !== callback);
      if (messageListeners[event].length === 0) delete messageListeners[event];
    };
  };
  
  // Add status getter for direct access to current status
  const getStatus = () => {
    let currentStatus: WebSocketStatus = 'CLOSED';
    // Get the current status from the store
    const unsubscribe = subscribe(state => {
      currentStatus = state.status;
    });
    unsubscribe();
    return currentStatus;
  };

  // Connect on initialization
  connect();
  
  // Return the store interface with properly typed subscribe method
  return {
    subscribe,  // This is the Svelte store subscribe method that returns an unsubscribe function
    connect,
    disconnect,
    send,
    clearMessages,
    on,
    // Add a getter for the current status
    get status() {
      return getStatus();
    }
  };
};

let socket: WebSocket | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;

export const socketStore = createSocketStore();
export const onSocketEvent = (event: string, callback: (data: any) => void) => socketStore.on(event, callback);
