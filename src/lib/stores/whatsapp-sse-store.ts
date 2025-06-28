import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { sseStore, onSSEEvent } from './sse-store';

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
    displayName: string | null;
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

function createWhatsAppSSEStore() {
    const { subscribe, update, set } = writable<WhatsAppState>(initialState);

    let unsubscribeHandlers: (() => void)[] = [];

    function setupEventListeners() {
        if (browser) {
            // Clean up any existing handlers
            unsubscribeHandlers.forEach(handler => handler());
            unsubscribeHandlers = [];

            // Listen for whatsapp events via SSE
            const qrCodeHandler = onSSEEvent('whatsapp:qrCode', (data) => {
                console.log('[WHATSAPP_SSE_STORE] QR code received:', data);
                const { qrCode, clientId, accountId } = data;
                update(state => ({
                    ...state,
                    qrCode,
                    clientId,
                    connectionStatus: 'awaiting_scan',
                    accountId
                }));
            });
            unsubscribeHandlers.push(qrCodeHandler);

            const connectedHandler = onSSEEvent('whatsapp:connected', (data) => {
                console.log('[WHATSAPP_SSE_STORE] Client connected:', data);
                const { 
                    clientId: connectedClientId, 
                    accountId: connectedAccountId, 
                    pushName, // Backend still uses pushName
                    phoneNumber 
                } = data;
                
                update(state => ({
                    ...state,
                    clientId: connectedClientId,
                    connectionStatus: 'connected',
                    displayName: pushName, // Store as displayName
                    phoneNumber: phoneNumber,
                    accountId: connectedAccountId,
                    qrCode: null
                }));
            });
            unsubscribeHandlers.push(connectedHandler);

            const authenticatedHandler = onSSEEvent('whatsapp:authenticated', (data) => {
                console.log('[WHATSAPP_SSE_STORE] Client authenticated:', data);
                const { 
                    clientId: connectedClientId, 
                    accountId: connectedAccountId, 
                    pushName,
                    phoneNumber 
                } = data;
                
                update(state => ({
                    ...state,
                    clientId: connectedClientId,
                    connectionStatus: 'authenticated',
                    displayName: pushName,
                    phoneNumber: phoneNumber,
                    accountId: connectedAccountId,
                    qrCode: null
                }));
            });
            unsubscribeHandlers.push(authenticatedHandler);

            const disconnectedHandler = onSSEEvent('whatsapp:disconnected', (data) => {
                console.log('[WHATSAPP_SSE_STORE] Client disconnected:', data);
                const { clientId: disconnectedClientId, accountId: disconnectedAccountId } = data;
                update(state => ({
                    ...state,
                    clientId: disconnectedClientId,
                    connectionStatus: 'disconnected',
                    accountId: disconnectedAccountId,
                    qrCode: null
                }));
            });
            unsubscribeHandlers.push(disconnectedHandler);
        }
    }

    // Request a new QR code
    async function requestQRCode() {
        if (!browser) return;
        
        console.log('[WHATSAPP_SSE_STORE] Requesting new QR code');
        update(state => ({ ...state, connectionStatus: 'connecting' }));
        
        try {
            await sseStore.sendRequest({
                type: 'whatsapp',
                scope: 'user:self',
                payload: { action: 'request_qr' }
            }, 10000); // 10 second timeout
        } catch (err) {
            console.error('[WHATSAPP_SSE_STORE] Failed to request QR code:', err);
            update(state => ({ ...state, connectionStatus: 'disconnected', error: err }));
        }
    }

    // Initialize SSE connection if in browser
    if (browser) {
        setupEventListeners();
    }

    return { 
        subscribe,
        update,
        reset: () => set(initialState),
        requestQRCode,
        setupEventListeners
    };
}

export const whatsAppSSEStore = createWhatsAppSSEStore();
