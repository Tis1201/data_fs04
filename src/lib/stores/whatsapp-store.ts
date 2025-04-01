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
            requestPairingCode: () => {},
            reset: () => {},
            setAccountId: () => {},
            setConnectionStatus: () => {}
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
            console.log('Received message from WebSocket:', message);
            
            // Extract the QR code from different message formats
            let qrCode = null;
            let clientId = null;
            let accountId = null;
            
            // Handle different message formats
            if (message.type === 'whatsapp' && message.action === 'qrCode' && message.data) {
                // New format with action
                qrCode = message.data.qrCode;
                clientId = message.data.clientId;
                accountId = message.data.accountId;
                console.log('Extracted QR code from whatsapp/qrCode format');
            } else if (message.type === 'whatsapp_qr' && message.data) {
                // Old format with specific type
                qrCode = message.data.qrCode;
                clientId = message.data.clientId;
                accountId = message.data.accountId;
                console.log('Extracted QR code from whatsapp_qr format');
            } else if (message.type === 'message' && message.data && message.data.qrCode) {
                // Generic message format
                qrCode = message.data.qrCode;
                clientId = message.data.clientId;
                accountId = message.data.accountId;
                console.log('Extracted QR code from generic message format');
            }
            
            // If we found a QR code, update the store
            if (qrCode) {
                console.log('Received QR code from WebSocket:', {
                    qrCodeLength: qrCode.length,
                    qrCodePreview: qrCode.substring(0, 20) + '...',
                    clientId,
                    accountId
                });
                
                // Extract QR code data for debugging
                console.log('QR code data:', qrCode);
                
                // Force update the store with the new QR code
                const newState = {
                    qrCode,
                    clientId: clientId || null,
                    accountId: accountId || null,
                    connectionStatus: 'connecting',
                    error: null,
                    pairingCode: null,
                    phoneNumber: null,
                    pushName: null
                };
                
                // Update the store
                set(newState);
                
                console.log('Store updated with QR code, new state:', {
                    qrCodeLength: newState.qrCode.length,
                    clientId: newState.clientId,
                    accountId: newState.accountId,
                    connectionStatus: newState.connectionStatus
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
                    
                    console.log('Connection status detected:', connectionStatus);
                    
                    return { 
                        ...state, 
                        connectionStatus,
                        clientId: message.data.clientId
                    };
                });
                
                // Force a UI update
                setTimeout(() => {
                    console.log('Checking connection status after timeout');
                    update(state => ({ ...state }));
                }, 1000);
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
    
    // This method has been removed as we now handle QR code requests directly via WebSocket in the QRCodeDisplay component
    
    // Request pairing code from server
    const requestPairingCode = async (accountId: string) => {
        if (!browser) return;
        
        update(state => ({ 
            ...state, 
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
            phoneNumber: null,
            pushName: null,
            clientId: null
        });
        
        console.log('WhatsApp store reset');
    };
    
    // Set account ID without making API calls
    const setAccountId = (accountId: string) => {
        update(state => ({
            ...state,
            accountId
        }));
        
        console.log(`Set account ID in WhatsApp store: ${accountId}`);
    };
    
    // Set connection status without making API calls
    const setConnectionStatus = (status: ConnectionStatus) => {
        update(state => ({
            ...state,
            connectionStatus: status
        }));
        
        console.log(`Set connection status in WhatsApp store: ${status}`);
    };
    
    return {
        subscribe,
        requestPairingCode,
        reset,
        setAccountId,
        setConnectionStatus
    };
};

export const whatsAppStore = createWhatsAppStore();
