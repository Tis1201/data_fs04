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
            
            // For demo purposes, generate a real QR code with a test URL
            // In production, this would come from the WebSocket server
            setTimeout(() => {
                // This is a base64 encoded QR code with the text "https://example.com/whatsapp-test"
                const mockQrCode = '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';
                
                // Immediately set the authenticated state for testing
                update(state => ({
                    ...state,
                    qrCode: mockQrCode,
                    connectionStatus: 'authenticated',
                    error: null
                }));
                
                // Show a manual authentication button for the user to proceed
            }, 1000);
            
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
