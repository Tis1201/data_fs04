import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

// Types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

export interface WhatsAppState {
    qrCode: string | null;
    pairingCode: string | null;
    connectionStatus: ConnectionStatus;
    error: string | null;
    accountId: string | null;
    phoneNumber: string | null;
    pushName: string | null;
    clientId: string | null;
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
            phoneNumber: null,
            pushName: null,
            clientId: null
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
        phoneNumber: null,
        pushName: null,
        clientId: null
    });
    
    // Initialize WebSocket listener
    const setupSocketListener = () => {
        if (!browser) return;
        
        const messageHandler = (message: any) => {
            // Handle messages from the new WhatsAppAccountManager implementation
            if (message.type === 'whatsapp_qr') {
                console.log('Received QR code from WebSocket:', message.data.qrCode ? `${message.data.qrCode.substring(0, 20)}...` : 'null');
                update(state => {
                    console.log('Updating WhatsApp store with QR code');
                    return { 
                        ...state, 
                        qrCode: message.data.qrCode,
                        clientId: message.data.clientId,
                        error: null,
                        connectionStatus: 'connecting'
                    };
                });
            } else if (message.type === 'whatsapp_state') {
                update(state => {
                    // Log the received message for debugging
                    console.log('Received WhatsApp state message:', message.data);
                    
                    // Map the state to our connection status
                    let connectionStatus: ConnectionStatus = 'disconnected';
                    if (message.data.state === 'connecting') connectionStatus = 'connecting';
                    if (message.data.state === 'connected') connectionStatus = 'connected';
                    if (message.data.state === 'authenticated') connectionStatus = 'authenticated';
                    
                    return { 
                        ...state, 
                        connectionStatus,
                        clientId: message.data.clientId
                    };
                });
            } else if (message.type === 'whatsapp_connected') {
                update(state => {
                    // Log the received message for debugging
                    console.log('Received WhatsApp connected message:', message.data);
                    
                    return { 
                        ...state, 
                        connectionStatus: 'authenticated',
                        clientId: message.data.clientId,
                        phoneNumber: message.data.info?.phoneNumber,
                        pushName: message.data.info?.pushName
                    };
                });
            } else if (message.type === 'whatsapp_message') {
                // Just log message events for now
                console.log('Received WhatsApp message:', message.data);
            }
            
            // Also handle the old format for backward compatibility
            else if (message.type === 'whatsapp') {
                if (message.action === 'qrCode') {
                    console.log('Received QR code from WebSocket (old format):', message.data.qrCode ? `${message.data.qrCode.substring(0, 20)}...` : 'null');
                    update(state => {
                        console.log('Updating WhatsApp store with QR code');
                        return { 
                            ...state, 
                            qrCode: message.data.qrCode,
                            error: null,
                            connectionStatus: 'connecting'
                        };
                    });
                } else if (message.action === 'pairingCode') {
                    update(state => ({ 
                        ...state, 
                        pairingCode: message.data.code,
                        error: null
                    }));
                } else if (message.action === 'connectionStatus') {
                    update(state => {
                        // Log the received message for debugging
                        console.log('Received connectionStatus message (old format):', message.data);
                        
                        return { 
                            ...state, 
                            connectionStatus: message.data.status,
                            // Store the client_id when it's available
                            ...(message.data.clientId ? { clientId: message.data.clientId } : {})
                        };
                    });
                } else if (message.action === 'error') {
                    update(state => ({ 
                        ...state, 
                        error: message.data.message,
                        connectionStatus: 'disconnected'
                    }));
                } else if (message.action === 'phoneInfo') {
                    update(state => ({ 
                        ...state, 
                        phoneNumber: message.data.phoneNumber,
                        pushName: message.data.pushName
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
                    // Initialize with a no-op function to prevent null/undefined errors
                    let unsubscribe = () => {};
                    
                    const timeoutId = setTimeout(() => {
                        unsubscribe();
                        resolve();
                    }, 3000);
                    
                    // Store the returned unsubscribe function
                    const unsub = socketStore.subscribe(($socket) => {
                        if ($socket && $socket.status === 'OPEN') {
                            clearTimeout(timeoutId);
                            unsub();
                            resolve();
                        }
                    });
                    
                    // Safely assign the unsubscribe function
                    if (typeof unsub === 'function') {
                        unsubscribe = unsub;
                    }
                });
            }
            
            // The real QR code will come from the WebSocket server
            // We'll just make the HTTP request to initiate the connection
            // and let the WebSocket handler update the store
            
            // Use SvelteKit form action instead of API
            const formData = new FormData();
            formData.append('phoneNumber', phoneNumber);
            formData.append('accountId', accountId);
            
            const response = await fetch('/admin/whatsapp/accounts?/requestQRCode', {
                method: 'POST',
                body: formData
            });
            
            // Check if the response is successful
            if (response.ok) {
                const result = await response.json();
                
                // If the server returned a QR code directly, update the store
                if (result.qrCode) {
                    console.log('Received QR code directly from server action');
                    update(state => ({
                        ...state,
                        qrCode: result.qrCode,
                        clientId: result.clientId,
                        connectionStatus: 'connecting'
                    }));
                }
            }
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
                    // Initialize with a no-op function to prevent null/undefined errors
                    let unsubscribe = () => {};
                    
                    const timeoutId = setTimeout(() => {
                        unsubscribe();
                        resolve();
                    }, 3000);
                    
                    // Store the returned unsubscribe function
                    const unsub = socketStore.subscribe(($socket) => {
                        if ($socket && $socket.status === 'OPEN') {
                            clearTimeout(timeoutId);
                            unsub();
                            resolve();
                        }
                    });
                    
                    // Safely assign the unsubscribe function
                    if (typeof unsub === 'function') {
                        unsubscribe = unsub;
                    }
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
