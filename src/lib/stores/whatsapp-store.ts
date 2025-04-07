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
    const { subscribe, update } = writable<WhatsAppState>(initialState);

    if (browser) {
        socketStore.on('whatsapp', (message: any) => {
            const { type, action, data } = message.message || {};
            console.log(`Received message: ${type}, ${action}, ${data?.clientId}`, message.message);

            if (action === 'qrCode' && data) {
                const { qrCode, clientId, accountId } = data;
                console.log('QR code received:', qrCode, clientId, accountId);
                update(state => ({
                    ...state,
                    qrCode,
                    clientId,
                    connectionStatus: 'connecting',
                    accountId
                }));
            } else {
                console.log('Unknown message action:', action);
            }

            if (action === 'connected' && data) {
                const { clientId, accountId } = data;
                console.log('Client connected:', clientId, accountId, data);
                update(state => ({
                    ...state,
                    clientId,
                    connectionStatus: 'connected',
                    accountId,
                    phoneNumber: data.phoneNumber,
                    pushName: data.pushName
                }));    
            }


        });



    }

    return { subscribe, update };
}

export const whatsAppStore = createWhatsAppStore();
