import { qrcode } from 'qrcode-terminal';
import { logger } from '$lib/server/logger';
import { WhatsAppAccountClient, DEFAULT_AUTH_DIR, DEFAULT_MEDIA_DIR } from '$lib/server/whatsapp/WhatsAppAccountClient';
import type { WhatsAppClientState } from '$lib/server/whatsapp/WhatsAppAccountClient';
import type { WhatsAppMessage } from '$lib/server/whatsapp/WhatsAppAccountClient';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import { whatsAppAccountManager } from '$lib/server/whatsapp/WhatsAppAccountManager';

// Define custom directories for this test
const TEST_AUTH_DIR = path.join(process.cwd(), 'tests/whatsapp/workings/sessions');
const TEST_MEDIA_DIR = path.join(process.cwd(), 'tests/whatsapp/workings/media');

// Ensure test directories exist
fs.mkdirSync(TEST_AUTH_DIR, { recursive: true });
fs.mkdirSync(TEST_MEDIA_DIR, { recursive: true });

async function main() {
    console.info('Hello World! Starting WhatsApp client test...');

    try {
        // Create a WhatsApp client directly
        console.info('Creating WhatsApp client...');
        const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient(undefined, undefined, {
            authDir: TEST_AUTH_DIR,
            mediaDir: TEST_MEDIA_DIR
        });

        // Wait for QR code
        const qrCode = await qrCodePromise;
        if (qrCode) {
            console.info('Displaying QR code...');
            qrcode.generate(qrCode, { small: true });
        }

        // Set up event listeners
        whatsAppAccountManager.on('qr', (clientId, qrCode) => {
            console.info(`New QR code for client ${clientId}:`);
            qrcode.generate(qrCode, { small: true });
        });

        whatsAppAccountManager.on('state', (clientId, state) => {
            console.info(`Client ${clientId} state changed to: ${state}`);
        });

        whatsAppAccountManager.on('message', (clientId, message) => {
            console.info(`New message from ${message.from}: ${message.content}`);
            console.info('Message details:', message);
        });

        // Wait for connection
        console.info('Waiting for connection...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Send a test message
        console.info('Sending test message...');
        const messageId = await whatsAppAccountManager.sendMessage(clientId, '6597350605@s.whatsapp.net', 'Hello from test!');
        console.info(`Message sent with ID: ${messageId}`);

        // Wait for a bit to see if message is received
        console.info('Waiting for messages...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Disconnect the client
        console.info('Disconnecting client...');
        await whatsAppAccountManager.disconnectClient(clientId);

        console.info('Test completed!');
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

// Run the test
main();