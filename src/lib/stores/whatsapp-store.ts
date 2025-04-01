import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import { socketStore } from './websocket-store';

// Types
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'awaiting_scan';

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
            clientId: null,
            messages: []
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
        clientId: null,
        messages: []
    });
    
    // Initialize WebSocket listener
    const setupSocketListener = () => {
        if (!browser) return;
        
        // Subscribe to all messages for debugging
        socketStore.on('message', (message: any) => {
            console.log('DEBUG: Received raw message from WebSocket:', message);
        });
        
        // Subscribe to whatsapp_message type specifically
        socketStore.on('whatsapp_message', (data: any) => {
            console.log('DEBUG: Received whatsapp_message event:', data);
        });
        
        // Subscribe to whatsapp type
        socketStore.on('whatsapp', (data: any) => {
            console.log('DEBUG: Received whatsapp event:', data);
        });
        
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
                    pushName: null,
                    messages: []
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
                    if (message.data.state === 'awaiting_scan') connectionStatus = 'awaiting_scan';
                    
                    console.log('Connection status detected:', connectionStatus);
                    
                    // Extract pushName and phoneNumber if available
                    const pushName = message.data.pushName || state.pushName;
                    const phoneNumber = message.data.phoneNumber || state.phoneNumber;
                    
                    if (pushName || phoneNumber) {
                        console.log('Client info received:', { pushName, phoneNumber });
                    }
                    
                    return { 
                        ...state, 
                        connectionStatus,
                        clientId: message.data.clientId,
                        pushName: pushName || state.pushName,
                        phoneNumber: phoneNumber || state.phoneNumber
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
            } else if (message.type === 'whatsapp_message' || (message.type === 'whatsapp' && message.action === 'message')) {
                // Handle message events and store them
                console.log('Received WhatsApp message:', message.data);
                
                try {
                    // Validate message data structure
                    if (!message.data || !message.data.message) {
                        console.error('Invalid message data format:', message);
                        return;
                    }
                    
                    const messageData = message.data.message;
                    
                    update(state => {
                        try {
                            // Create a new message object
                            const newMessage: WhatsAppMessage = {
                                id: messageData.id || messageData.messageId || crypto.randomUUID(),
                                from: messageData.from || messageData.sender || 'Unknown',
                                to: messageData.to || messageData.recipient || '',
                                content: messageData.content || messageData.body || '',
                                timestamp: messageData.timestamp || Date.now(),
                                isFromMe: messageData.isFromMe || false,
                                type: messageData.type || 'text',
                                mediaUrl: messageData.mediaUrl || '',
                                caption: messageData.caption || '',
                                fileName: messageData.fileName || '',
                                fileSize: messageData.fileSize || 0,
                                mimetype: messageData.mimetype || '',
                                isReply: messageData.isReply || false,
                                replyToMessageId: messageData.replyToMessageId || '',
                                replyToMessage: messageData.replyToMessage || '',
                                replyToParticipant: messageData.replyToParticipant || '',
                                clientId: message.data.clientId || state.clientId,
                                accountId: messageData.accountId || state.accountId
                            };
                            
                            console.log('Processing message:', newMessage.id);
                            
                            // Check if we already have this message (avoid duplicates)
                            const messageExists = state.messages?.some(msg => msg.id === newMessage.id) || false;
                            if (messageExists) {
                                console.log('Message already exists in store, skipping:', newMessage.id);
                                return state;
                            }
                            
                            console.log('Adding new message to store:', newMessage.id);
                            
                            // Add the new message to the state
                            const messages = [...(state.messages || []), newMessage];
                            
                            // Limit the number of messages to prevent memory issues
                            const MAX_MESSAGES = 100;
                            if (messages.length > MAX_MESSAGES) {
                                messages.shift();
                            }
                            
                            return { 
                                ...state, 
                                messages
                            };
                        } catch (error) {
                            console.error('Error processing message in store update:', error);
                            return state;
                        }
                    });
                } catch (error) {
                    console.error('Error processing WhatsApp message:', error);
                }
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
    
    // Store the current state
    let currentState: WhatsAppState = {
        qrCode: null,
        pairingCode: null,
        connectionStatus: 'disconnected',
        error: null,
        accountId: null,
        phoneNumber: null,
        pushName: null,
        clientId: null
    };
    
    // Update the current state when the store changes
    subscribe(state => {
        currentState = state;
    });
    
    return {
        subscribe,
        requestPairingCode,
        reset,
        setAccountId,
        setConnectionStatus,
        // Add a method to get the current state
        getState: () => currentState
    };
};

export const whatsAppStore = createWhatsAppStore();
