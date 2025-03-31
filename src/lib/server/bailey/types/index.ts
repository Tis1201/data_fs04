import baileys from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
const { proto } = baileys;
import WebSocket from 'ws';

// WhatsApp client state types
export type WhatsAppClientState = 'connecting' | 'connected' | 'authenticated' | 'disconnected';

// WhatsApp client manager interface
export interface WhatsAppClientManager {
    id: string;
    client: WASocket | null;
    state: WhatsAppClientState;
    qrCode: string | null;
    pairingCode: string | null;
    phoneNumber: string | null;
    socket: WebSocket | null;
    accountId: string | null;
    pushName?: string;
}

// Message type for WebSocket communication
export interface WhatsAppWebSocketMessage {
    type: 'whatsapp';
    action: string;
    data: any;
}

// Type for incoming WhatsApp message
export interface WhatsAppIncomingMessage {
    sender: string;
    content: string;
    timestamp: string;
    messageId: string;
    rawMessage: proto.IWebMessageInfo;
}
