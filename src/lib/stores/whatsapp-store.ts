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
    phoneNumber: string | null;
    pushName: string | null;
}

const initialState: WhatsAppState = {
    connectionStatus: 'disconnected',
    clientId: null,
    messages: [],
    qrCode: null,
    accountId: null,
    phoneNumber: null,
    pushName: null
};

function createWhatsAppStore() {
    const { subscribe, update } = writable<WhatsAppState>(initialState);

    if (browser) {
        socketStore.on('whatsapp', (message: any) => {

            console.log('Received message:', message);

            const {action, content} = message.payload || {};
            console.log(`Received message: ${action}, ${content?.clientId}`, message.message);

            if (!content) {
                console.log('Message data is missing:', message);
                return;
            }

            switch (action) {
                case 'qrCode':
                    const { qrCode, clientId, accountId } = content;
                    console.log('QR code received:', qrCode, clientId, accountId);
                    update(state => ({
                        ...state,
                        qrCode,
                        clientId,
                        connectionStatus: 'connecting',
                        accountId
                    }));
                    break;

                case 'connected':
                    const { clientId: connectedClientId, accountId: connectedAccountId, pushName, phoneNumber } = data;
                    console.log('Client connected:', connectedClientId, connectedAccountId, data);
                    update(state => ({
                        ...state,
                        clientId: connectedClientId,
                        connectionStatus: 'connected',
                        pushName: pushName,
                        phoneNumber: phoneNumber,
                        accountId: connectedAccountId,
                        qrCode: null
                    }));
                    break;

                case 'disconnected':
                    const { clientId: disconnectedClientId, accountId: disconnectedAccountId } = data;
                    console.log('Client disconnected:', disconnectedClientId, disconnectedAccountId, data);
                    update(state => ({
                        ...state,
                        clientId: disconnectedClientId,
                        connectionStatus: 'disconnected',
                        accountId: disconnectedAccountId,
                        qrCode: null
                    }));
                    break;
 
                default:
                    console.log('Unknown message action:', action, message);
            } 
        });
    }

    return { subscribe, update };
}

export const whatsAppStore = createWhatsAppStore();
