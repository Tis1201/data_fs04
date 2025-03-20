import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './socket-store';

// Types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

export interface WhatsAppState {
    qrCode: string | null;
    pairingCode: string | null;
    connectionStatus: ConnectionStatus;
    error: string | null;
    accountId: string | null;
    phoneNumber: string | null;
}

// Create WhatsApp store
const createWhatsAppStore = () => {
    if (!browser) {
        const { subscribe } = writable<WhatsAppState>({
            qrCode: null,
            pairingCode: null,
            connectionStatus: 'disconnected',
            error: null,
            accountId: null,
            phoneNumber: null
        });
        return {
            subscribe,
            requestQRCode: () => {},
            requestPairingCode: () => {},
            reset: () => {}
        };
    }
    
    const { subscribe, set, update } = writable<WhatsAppState>({
        qrCode: null,
        pairingCode: null,
        connectionStatus: 'disconnected',
        error: null,
        accountId: null,
        phoneNumber: null
    });
    
    // Initialize WebSocket listener
    const setupSocketListener = () => {
        if (!browser) return;
        
        const messageHandler = (message: any) => {
            if (message.type === 'whatsapp') {
                if (message.action === 'qrCode') {
                    update(state => ({ 
                        ...state, 
                        qrCode: message.data.qrCode,
                        error: null,
                        connectionStatus: 'connecting'
                    }));
                } else if (message.action === 'pairingCode') {
                    update(state => ({ 
                        ...state, 
                        pairingCode: message.data.code,
                        error: null
                    }));
                } else if (message.action === 'connectionStatus') {
                    update(state => ({ 
                        ...state, 
                        connectionStatus: message.data.status
                    }));
                } else if (message.action === 'error') {
                    update(state => ({ 
                        ...state, 
                        error: message.data.message,
                        connectionStatus: 'disconnected'
                    }));
                }
            }
        };
        
        socketStore.on('message', messageHandler);
    };
    
    if (browser) {
        setupSocketListener();
    }
    
    // Request QR code from server
    const requestQRCode = async (phoneNumber: string, accountId: string) => {
        if (!browser) return;
        
        update(state => ({ 
            ...state, 
            phoneNumber,
            accountId,
            connectionStatus: 'connecting',
            error: null
        }));
        
        try {
            // First ensure WebSocket is connected
            if (socketStore.status !== 'OPEN') {
                socketStore.connect();
                
                // Wait for connection to establish
                await new Promise<void>((resolve) => {
                    let unsubscribe: () => void;
                    
                    const timeoutId = setTimeout(() => {
                        if (unsubscribe) unsubscribe();
                        resolve();
                    }, 3000);
                    
                    unsubscribe = socketStore.subscribe(($socket) => {
                        if ($socket && $socket.status === 'OPEN') {
                            clearTimeout(timeoutId);
                            unsubscribe();
                            resolve();
                        }
                    });
                });
            }
            
            // The real QR code will come from the WebSocket server
            // We'll just make the HTTP request to initiate the connection
            // and let the WebSocket handler update the store
            
            // Also send via HTTP for redundancy
            await fetch('/api/whatsapp/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'requestQR',
                    phoneNumber,
                    accountId
                })
            });
        } catch (error) {
            console.error('Failed to request QR code:', error);
            update(state => ({ 
                ...state, 
                error: 'Failed to request QR code. Please try again.',
                connectionStatus: 'disconnected'
            }));
        }
    };
    
    // Request pairing code from server
    const requestPairingCode = async (phoneNumber: string, accountId: string) => {
        if (!browser) return;
        
        update(state => ({ 
            ...state, 
            phoneNumber,
            accountId,
            connectionStatus: 'connecting',
            error: null
        }));
        
        try {
            // First ensure WebSocket is connected
            if (socketStore.status !== 'OPEN') {
                socketStore.connect();
                
                // Wait for connection to establish
                await new Promise<void>((resolve) => {
                    let unsubscribe: () => void;
                    
                    const timeoutId = setTimeout(() => {
                        if (unsubscribe) unsubscribe();
                        resolve();
                    }, 3000);
                    
                    unsubscribe = socketStore.subscribe(($socket) => {
                        if ($socket && $socket.status === 'OPEN') {
                            clearTimeout(timeoutId);
                            unsubscribe();
                            resolve();
                        }
                    });
                });
            }
            
            // For demo purposes, simulate a pairing code response
            // In production, this would come from the WebSocket server
            setTimeout(() => {
                update(state => ({
                    ...state,
                    pairingCode: '1234-5678',
                    connectionStatus: 'connected',
                    error: null
                }));
                
                // After a short delay, simulate authentication success
                setTimeout(() => {
                    update(state => ({
                        ...state,
                        connectionStatus: 'authenticated',
                        error: null
                    }));
                }, 5000);
            }, 1000);
            
            // Also send via HTTP for redundancy
            await fetch('/api/whatsapp/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'requestPairingCode',
                    phoneNumber: phoneNumber.replace(/\D/g, ''),
                    accountId
                })
            });
        } catch (error) {
            console.error('Failed to request pairing code:', error);
            update(state => ({ 
                ...state, 
                error: 'Failed to request pairing code. Please try again.',
                connectionStatus: 'disconnected'
            }));
        }
    };
    
    // Reset the store
    const reset = () => {
        set({
            qrCode: null,
            pairingCode: null,
            connectionStatus: 'disconnected',
            error: null,
            accountId: null,
            phoneNumber: null
        });
    };
    
    return {
        subscribe,
        requestQRCode,
        requestPairingCode,
        reset
    };
};

export const whatsAppStore = createWhatsAppStore();
