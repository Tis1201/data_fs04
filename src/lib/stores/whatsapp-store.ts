import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  isFromMe: boolean;
  type: string;
}

export interface WhatsAppState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'authenticated';
  clientId: string | null;
  messages: WhatsAppMessage[];
  qrCode: string | null;
  accountId: string | null;
}

const initialState: WhatsAppState = {
  connectionStatus: 'disconnected',
  clientId: null,
  messages: [],
  qrCode: null,
  accountId: null
};

function createWhatsAppStore() {

  const { subscribe, set, update } = writable<WhatsAppState>(initialState);

  if (browser) {
    const messageHandler = (message: any) => {
        handle_message(message, update);
    };

    socketStore.on('whatsapp', messageHandler);
    // socketStore.on('whatsapp_message', messageHandler);
    
  }

  return {
    subscribe,
    update
  };
}

function handle_message(message: any, update: (fn: (state: WhatsAppState) => WhatsAppState) => void) {
    const ws_message        = message["message"];
    const ws_message_type   = ws_message["type"];
    const ws_message_action = ws_message["action"];
    const ws_message_data   = ws_message["data"];
    const client_id         = ws_message_data["clientId"];
   
    console.log('Received message:', ws_message_type, ws_message_action, client_id, JSON.stringify(ws_message));

    switch (ws_message_action) {
        case 'qrCode':
            handleQRCodeMessage(message, update);
            break;
        default:
            console.log('Unknown message action:', ws_message_action);
            break;
    }
}

function handleQRCodeMessage(message: any, update: (fn: (state: WhatsAppState) => WhatsAppState) => void) {
    const ws_message = message["message"];
    const ws_message_data = ws_message["data"];
    const qrCode = ws_message_data["qrCode"];
    const clientId = ws_message_data["clientId"];
    const accountId = ws_message_data["accountId"];

    console.log('QR code received:', qrCode, clientId, accountId);
    
    // Update the store with the new QR code data
    update((state) => ({
        ...state,
        qrCode: qrCode,
        clientId: clientId,
        connectionStatus: 'connecting',
        accountId: accountId
    }));
}

export const whatsAppStore = createWhatsAppStore();
