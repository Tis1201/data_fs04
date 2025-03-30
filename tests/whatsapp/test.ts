//Node App to hello world using baileys
import { whatsAppAccountManager } from '../../src/lib/server/whatsapp/WhatsAppAccountManager';
import { WhatsAppAccountClient } from '../../src/lib/server/whatsapp/WhatsAppAccountClient';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

/**
 * Simple test script to create a WhatsApp client and display the QR code
 */
async function main() {
  console.info('Hello World! Starting WhatsApp client test...');
  
  try {
    // Phone number in E.164 format without the plus sign
    const phoneNumber = '6597350605'; // Replace with your actual phone number
    const accountId = 'test-account-1';
    
    // Session ID to restore (or null to create a new one)
    const sessionId = '3c7a96e4-cc38-4319-8d7a-ab9dacb8213f';
    
    // Check if session exists and restore or create a new client
    console.info('Checking for existing session...');
    const sessionExists = whatsAppAccountManager.sessionExists(sessionId);
    console.info(sessionExists ? `Found existing session: ${sessionId}` : `No existing session found for ID: ${sessionId}`);
    
    console.info('Restoring or creating WhatsApp client...');
    const { clientId, qrCodePromise, restored } = await whatsAppAccountManager.restoreOrCreateClient(
      sessionId,
      phoneNumber, 
      accountId
    );
    
    if (restored) {
      console.info(`Restored existing WhatsApp client with ID: ${clientId}`);
    } else {
      console.info(`Created new WhatsApp client with ID: ${clientId}`);
    }
    
    console.info(`WhatsApp client created with ID: ${clientId}`);
    console.info('Waiting for QR code...');
    
    // Get the client instance immediately to set up QR code handling
    const client = whatsAppAccountManager.getClient(clientId);
    if (!client) {
      throw new Error(`Failed to get client with ID: ${clientId}`);
    }
    
    // Set up QR code refresh handling
    let lastQrCode = '';
    
    // Set up all event listeners directly on the WhatsAppAccountClient instance
    setupClientEventListeners(client, phoneNumber);
    
    // Wait for the initial QR code
    const initialQrCode = await qrCodePromise;
    lastQrCode = initialQrCode;
    
    // We don't need to display the QR code here again as it will be displayed by the event handler
    
    console.info('\nWaiting for connection...');
    
    // Keep the process running to maintain the connection
    process.stdin.resume();
    console.info('Press Ctrl+C to exit');
    
  } catch (error) {
    console.error(`Error in main function: ${error}`);
  }
}

// Run the main function
/**
 * Set up all event listeners for a WhatsAppAccountClient instance
 * @param client The WhatsAppAccountClient instance
 * @param phoneNumber The phone number for this client
 */
function setupClientEventListeners(client: WhatsAppAccountClient, phoneNumber: string): void {
  // Set up QR code event listener
  let lastQrCode = '';
  client.on('qr', (qrCode) => {
    // Only display if it's a new QR code
    if (qrCode !== lastQrCode) {
      lastQrCode = qrCode;
      console.log('\nNew QR code received. Scan this QR code with your WhatsApp app:\n');
      qrcode.generate(qrCode, { small: true });
    }
  });
  
  // Set up state change event listener
  client.on('state', (state) => {
    console.info(`=== Client state changed: ${state}`);

    if (state === 'connecting') {
      console.info('=== Client is connecting...');
    }

    if (state === 'disconnected') {
      console.info('=== Client disconnected');
    }
    
    if (state === 'connected') {
      console.info('=== Client connected successfully!');
    }
  });
  
  // Listen for logout events
  client.on('logout', () => {
    console.info('Client logged out');
  });
  
  // Listen for connected events and handle client info
  client.on('connected', (info) => {
    console.info('Client connected event received:', info);
    
    // Get client info
    const clientInfo = client.getInfo();
    console.info('Client info:', clientInfo);
    
    // Save client ID to a file for future reference
    const clientInfoDir = path.join(process.cwd(), 'whatsapp-client-info');
    if (!fs.existsSync(clientInfoDir)) {
      fs.mkdirSync(clientInfoDir, { recursive: true });
    }
    
    const clientInfoFile = path.join(clientInfoDir, `${phoneNumber}.json`);
    fs.writeFileSync(
      clientInfoFile, 
      JSON.stringify({
        clientId: clientInfo.id,
        phoneNumber: clientInfo.phoneNumber,
        accountId: clientInfo.accountId,
        lastConnected: new Date().toISOString()
      }, null, 2)
    );
    
    console.info(`Client info saved to ${clientInfoFile}`);
  });
  
  // Listen for message events
  client.on('message', (message) => {
    console.info(`New message from ${message.from}: ${message.content}`);
  });
  
  // Listen for error events
  client.on('error', (error) => {
    console.error(`Client error: ${error}`);
  });
}

main().catch((error) => console.error(`Unhandled error: ${error}`));