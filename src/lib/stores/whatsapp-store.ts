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

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'awaiting_scan';

export interface WhatsAppState {
    connectionStatus: ConnectionStatus;
    clientId: string | null;
    messages: WhatsAppMessage[];
    qrCode: string | null;
    accountId: string | null;
    phoneNumber: string | null;
    displayName: string | null; // Standardized name field
}

const initialState: WhatsAppState = {
    connectionStatus: 'disconnected',
    clientId: null,
    messages: [],
    qrCode: null,
    accountId: null,
    phoneNumber: null,
    displayName: null
};

function createWhatsAppStore() {
    const { subscribe, update, set } = writable<WhatsAppState>(initialState);

    if (browser) {
        socketStore.on('whatsapp', (message: any) => {
            console.log('[WHATSAPP_STORE] Received message:', message);

            const {action, content} = message.payload || {};
            
            if (!content) {
                console.error('[WHATSAPP_STORE] Message content is missing:', message);
                return;
            }

            switch (action) {
                case 'qrCode':
                    const { qrCode, clientId, accountId } = content;
                    console.log('[WHATSAPP_STORE] QR code received for client:', clientId);
                    update(state => ({
                        ...state,
                        qrCode,
                        clientId,
                        connectionStatus: 'awaiting_scan',
                        accountId
                    }));
                    break;

                case 'connected':
                    // Extract fields with clear naming
                    const { 
                        clientId: connectedClientId, 
                        accountId: connectedAccountId, 
                        pushName, // Backend still uses pushName
                        phoneNumber 
                    } = content;
                    
                    // Validate critical fields
                    if (!pushName) {
                        console.warn('[WHATSAPP_STORE] Missing displayName in connected message:', content);
                    }
                    
                    console.log('[WHATSAPP_STORE] Client connected:', {
                        clientId: connectedClientId,
                        displayName: pushName, // Map pushName to displayName
                        phoneNumber,
                        accountId: connectedAccountId
                    });
                    
                    update(state => ({
                        ...state,
                        clientId: connectedClientId,
                        connectionStatus: 'connected',
                        displayName: pushName, // Store as displayName
                        phoneNumber: phoneNumber,
                        accountId: connectedAccountId,
                        qrCode: null
                    }));
                    break;

                case 'disconnected':
                    const { clientId: disconnectedClientId, accountId: disconnectedAccountId } = content;
                    console.log('[WHATSAPP_STORE] Client disconnected:', {
                        clientId: disconnectedClientId,
                        accountId: disconnectedAccountId
                    });
                    update(state => ({
                        ...state,
                        clientId: disconnectedClientId,
                        connectionStatus: 'disconnected',
                        accountId: disconnectedAccountId,
                        qrCode: null
                    }));
                    break;
 
                default:
                    console.log('[WHATSAPP_STORE] Unknown message action:', action, message);
            } 
        });
    }

    return { 
        subscribe, 
        update,
        reset: () => set(initialState)
    };
}

export const whatsAppStore = createWhatsAppStore();
