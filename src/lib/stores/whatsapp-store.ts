import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

// Types
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'awaiting_scan';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  isFromMe: boolean;
  type: string;
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  fileSize?: number;
  mimetype?: string;
  isReply?: boolean;
  replyToMessageId?: string;
  replyToMessage?: string;
  replyToParticipant?: string;
  clientId?: string;
  accountId?: string;
}

export interface WhatsAppState {
  qrCode: string | null;
  pairingCode: string | null;
  connectionStatus: ConnectionStatus;
  error: string | null;
  accountId: string | null;
  phoneNumber: string | null;
  pushName: string | null;
  clientId: string | null;
  messages: WhatsAppMessage[];
}

// Debug flag for logging (can be tied to environment settings)
const DEBUG = true;

/**
 * Helper: Logs debug messages when DEBUG is true.
 */
function debugLog(...args: any[]) {
  if (DEBUG) console.log(...args);
}

/**
 * Extract QR code info from a message if available.
 */
function extractQRCodeData(message: any) {
  if (
    (message.type === 'whatsapp' && message.action === 'qrCode' && message.data) ||
    (message.type === 'whatsapp_qr' && message.data) ||
    (message.type === 'message' && message.data?.qrCode)
  ) {
    return {
      qrCode: message.data.qrCode,
      clientId: message.data.clientId,
      accountId: message.data.accountId
    };
  }
  return null;
}

/**
 * Handle WhatsApp state messages.
 */
function handleWhatsAppStateMessage(
  message: any,
  update: (fn: (state: WhatsAppState) => WhatsAppState) => void,
  currentState: WhatsAppState
) {
  if (message.data.type === 'ping' || message.data.type === 'pong') return;

  let connectionStatus: ConnectionStatus = 'disconnected';
  switch (message.data.state) {
    case 'connecting':
      connectionStatus = 'connecting';
      break;
    case 'connected':
      connectionStatus = 'connected';
      break;
    case 'authenticated':
      connectionStatus = 'authenticated';
      break;
    case 'awaiting_scan':
      connectionStatus = 'awaiting_scan';
      break;
  }

  const pushName = message.data.pushName || currentState.pushName;
  const phoneNumber = message.data.phoneNumber || currentState.phoneNumber;

  debugLog('WhatsApp state updated:', { connectionStatus, pushName, phoneNumber });

  update((state) => ({
    ...state,
    connectionStatus,
    clientId: message.data.clientId,
    pushName,
    phoneNumber
  }));

  // Force a UI update after a delay (if needed)
  setTimeout(() => update((state) => ({ ...state })), 1000);
}

/**
 * Process a connected message.
 */
function handleConnectedMessage(
  message: any,
  update: (fn: (state: WhatsAppState) => WhatsAppState) => void
) {
  debugLog('Received WhatsApp connected message:', message.data);
  update((state) => ({
    ...state,
    connectionStatus: 'authenticated',
    clientId: message.data.clientId,
    phoneNumber: message.data.info?.phoneNumber,
    pushName: message.data.info?.pushName
  }));
}

/**
 * Process a new WhatsApp chat message.
 */
function handleWhatsAppChatMessage(
  message: any,
  update: (fn: (state: WhatsAppState) => WhatsAppState) => void,
  currentState: WhatsAppState
) {
  try {
    if (!message.data || !message.data.message) {
      console.error('Invalid message format:', message);
      return;
    }
    const msgData = message.data.message;
    const newMessage: WhatsAppMessage = {
      id: msgData.id || msgData.messageId || crypto.randomUUID(),
      from: msgData.from || msgData.sender || 'Unknown',
      to: msgData.to || msgData.recipient || '',
      content: msgData.content || msgData.body || '',
      timestamp: msgData.timestamp || Date.now(),
      isFromMe: msgData.isFromMe || false,
      type: msgData.type || 'text',
      mediaUrl: msgData.mediaUrl || '',
      caption: msgData.caption || '',
      fileName: msgData.fileName || '',
      fileSize: msgData.fileSize || 0,
      mimetype: msgData.mimetype || '',
      isReply: msgData.isReply || false,
      replyToMessageId: msgData.replyToMessageId || '',
      replyToMessage: msgData.replyToMessage || '',
      replyToParticipant: msgData.replyToParticipant || '',
      clientId: message.data.clientId || currentState.clientId,
      accountId: msgData.accountId || currentState.accountId
    };

    debugLog('Processing new WhatsApp chat message:', newMessage.id);
    update((state) => {
      // Prevent duplicate messages
      if (state.messages.some((msg) => msg.id === newMessage.id)) {
        debugLog('Message already exists, skipping:', newMessage.id);
        return state;
      }
      const messages = [...(state.messages || []), newMessage];
      // Limit messages to a maximum count
      const MAX_MESSAGES = 100;
      if (messages.length > MAX_MESSAGES) messages.shift();
      return { ...state, messages };
    });
  } catch (error) {
    console.error('Error processing WhatsApp chat message:', error);
  }
}

/**
 * Handle legacy (old format) messages.
 */
function handleLegacyMessage(
  message: any,
  update: (fn: (state: WhatsAppState) => WhatsAppState) => void
) {
  switch (message.action) {
    case 'qrCode':
      update((state) => ({
        ...state,
        qrCode: message.data.qrCode,
        error: null,
        connectionStatus: 'connecting'
      }));
      break;
    case 'pairingCode':
      update((state) => ({ ...state, pairingCode: message.data.code, error: null }));
      break;
    case 'connectionStatus':
      update((state) => ({
        ...state,
        connectionStatus: message.data.status,
        ...(message.data.clientId ? { clientId: message.data.clientId } : {})
      }));
      break;
    case 'error':
      update((state) => ({
        ...state,
        error: message.data.message,
        connectionStatus: 'disconnected'
      }));
      break;
    case 'phoneInfo':
      update((state) => ({
        ...state,
        phoneNumber: message.data.phoneNumber,
        pushName: message.data.pushName
      }));
      break;
  }
}

/**
 * Setup WebSocket listeners.
 */
function setupSocketListener(
  update: (fn: (state: WhatsAppState) => WhatsAppState) => void,
  set: (state: WhatsAppState) => void,
  getCurrentState: () => WhatsAppState
) {
  if (!browser) return;

  const messageHandler = (message: any) => {
    if (message.type === 'pong') return;

    // Check for QR code data
    const qrData = extractQRCodeData(message);
    if (qrData && qrData.qrCode) {
      debugLog('QR code data received:', {
        qrCodeLength: qrData.qrCode.length,
        clientId: qrData.clientId,
        accountId: qrData.accountId
      });
      set({
        qrCode: qrData.qrCode,
        clientId: qrData.clientId || null,
        accountId: qrData.accountId || null,
        connectionStatus: 'connecting',
        error: null,
        pairingCode: null,
        phoneNumber: null,
        pushName: null,
        messages: []
      });
      return;
    }

    // Process different message types
    switch (message.type) {
      case 'whatsapp_state':
        handleWhatsAppStateMessage(message, update, getCurrentState());
        break;
      case 'whatsapp_connected':
        handleConnectedMessage(message, update);
        break;
      case 'whatsapp_message':
        handleWhatsAppChatMessage(message, update, getCurrentState());
        break;
      case 'whatsapp':
        // For legacy or combined message types
        if (message.action === 'message') {
          handleWhatsAppChatMessage(message, update, getCurrentState());
        } else {
          handleLegacyMessage(message, update);
        }
        break;
      default:
        debugLog('Unhandled message type:', message);
    }
  };

  // Attach the handler to multiple event types for completeness
  socketStore.on('message', messageHandler);
  socketStore.on('whatsapp_message', messageHandler);
  socketStore.on('whatsapp', messageHandler);
}

// Initial state definition
let currentState: WhatsAppState = {
  qrCode: null,
  pairingCode: null,
  connectionStatus: 'disconnected',
  error: null,
  accountId: null,
  phoneNumber: null,
  pushName: null,
  clientId: null,
  messages: []
};

function createWhatsAppStore() {
  // For server-side environments, return a stub store
  if (!browser) {
    const { subscribe } = writable<WhatsAppState>(currentState);
    return {
      subscribe,
      requestPairingCode: () => {},
      reset: () => {},
      setAccountId: () => {},
      setConnectionStatus: () => {},
      setClientId: () => {}
    };
  }

  const { subscribe, set, update } = writable<WhatsAppState>({
    qrCode: null,
    pairingCode: null,
    connectionStatus: 'disconnected',
    error: null,
    accountId: null,
    phoneNumber: null,
    pushName: null,
    clientId: null,
    messages: []
  });

  // Setup WebSocket listener with a getter for the current state
  setupSocketListener(update, set, () => currentState);

  /**
   * Request pairing code and simulate connection flow.
   */
  const requestPairingCode = async (accountId: string, phoneNumber: string) => {
    update((state) => ({
      ...state,
      accountId,
      connectionStatus: 'connecting',
      error: null
    }));

    try {
      // Ensure WebSocket is connected
      if (socketStore.status !== 'OPEN') {
        socketStore.connect();
        await new Promise<void>((resolve) => {
          let unsubscribe = () => {};
          const timeoutId = setTimeout(() => {
            unsubscribe();
            resolve();
          }, 3000);
          const unsub = socketStore.subscribe(($socket) => {
            if ($socket && $socket.status === 'OPEN') {
              clearTimeout(timeoutId);
              unsub();
              resolve();
            }
          });
          if (typeof unsub === 'function') unsubscribe = unsub;
        });
      }

      // Simulate pairing code response for demo purposes
      setTimeout(() => {
        update((state) => ({
          ...state,
          pairingCode: '1234-5678',
          connectionStatus: 'connected',
          error: null
        }));

        // Simulate successful authentication after delay
        setTimeout(() => {
          update((state) => ({
            ...state,
            connectionStatus: 'authenticated',
            error: null
          }));
        }, 5000);
      }, 1000);

      // Use SvelteKit form action instead of API
      const formData = new FormData();
      formData.append('phoneNumber', phoneNumber.replace(/\D/g, ''));
      formData.append('accountId', accountId);

      await fetch('/admin/whatsapp/accounts?/requestPairingCode', {
        method: 'POST',
        body: formData
      });
    } catch (error) {
      console.error('Failed to request pairing code:', error);
      update((state) => ({
        ...state,
        error: 'Failed to request pairing code. Please try again.',
        connectionStatus: 'disconnected'
      }));
    }
  };

  const reset = () => {
    set({
      qrCode: null,
      pairingCode: null,
      connectionStatus: 'disconnected',
      error: null,
      accountId: null,
      phoneNumber: null,
      pushName: null,
      clientId: null,
      messages: []
    });
    debugLog('WhatsApp store has been reset.');
  };

  const setAccountId = (accountId: string) => {
    update((state) => ({ ...state, accountId }));
    debugLog(`Account ID set: ${accountId}`);
  };

  const setConnectionStatus = (status: ConnectionStatus) => {
    update((state) => ({ ...state, connectionStatus: status }));
    debugLog(`Connection status set: ${status}`);
  };

  const setClientId = (clientId: string) => {
    update((state) => ({ ...state, clientId }));
    debugLog(`Client ID set: ${clientId}`);
  };

  // Keep the current state in sync
  subscribe((state) => {
    currentState = state;
  });

  return {
    subscribe,
    requestPairingCode,
    reset,
    setAccountId,
    setConnectionStatus,
    setClientId,
    getState: () => currentState
  };
}

export const whatsAppStore = createWhatsAppStore();
