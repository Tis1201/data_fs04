//Node App to hello world using baileys
import { WhatsAppAccountManager } from '../../src/lib/server/whatsapp/WhatsAppAccountManager';
import { WhatsAppAccountClient } from '../../src/lib/server/whatsapp/WhatsAppAccountClient';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

// Define custom directories for this test
const TEST_AUTH_DIR = path.join(process.cwd(), 'tests/whatsapp/workings/sessions');
const TEST_MEDIA_DIR = path.join(process.cwd(), 'tests/whatsapp/workings/media');

// Ensure test directories exist
if (!fs.existsSync(TEST_AUTH_DIR)) {
  fs.mkdirSync(TEST_AUTH_DIR, { recursive: true });
}

if (!fs.existsSync(TEST_MEDIA_DIR)) {
  fs.mkdirSync(TEST_MEDIA_DIR, { recursive: true });
}

/**
 * Simple test script to create a WhatsApp client and display the QR code
 */
async function main() {
  console.info('Hello World! Starting WhatsApp client test...');
  
  // Create a WhatsApp account manager with custom directories
  const whatsAppAccountManager = new WhatsAppAccountManager({
    authDir: TEST_AUTH_DIR,
    mediaDir: TEST_MEDIA_DIR
  });
  
  try {
    
    // Use null to create a new session in the custom directory
    // const sessionId = null;
    const sessionId = '34545f39-af8b-4950-9bad-8496740639e1'
    
    // Check if session exists and restore or create a new client
    console.info('Checking for existing session...');
    let sessionExists = false;
    if (sessionId) {
      // Check if session directory exists in our custom auth directory
      const sessionDir = path.join(TEST_AUTH_DIR, sessionId);
      sessionExists = fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0;
      console.info(sessionExists ? `Found existing session: ${sessionId}` : `No existing session found for ID: ${sessionId}`);
    } else {
      console.info('No session ID provided, will create a new client');
    }
    
    console.info('Restoring or creating WhatsApp client...');
    const { clientId, qrCodePromise, restored } = await whatsAppAccountManager.restoreOrCreateClient(
      sessionId
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
    setupClientEventListeners(client, clientId);
    
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
 * @param clientId Optional client ID for logging purposes
 */
function setupClientEventListeners(client: WhatsAppAccountClient, clientId?: string): void {
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
    
    // // Save client ID to a file for future reference
    // const clientInfoDir = path.join(process.cwd(), 'whatsapp-client-info');
    // if (!fs.existsSync(clientInfoDir)) {
    //   fs.mkdirSync(clientInfoDir, { recursive: true });
    // }
    
    // Get phone number from client info or use client ID if not available
    // const clientInfoFile = path.join(clientInfoDir, `${clientInfo.phoneNumber || clientId}.json`);
    // fs.writeFileSync(
    //   clientInfoFile, 
    //   JSON.stringify({
    //     clientId: clientInfo.id,
    //     phoneNumber: clientInfo.phoneNumber,
    //     accountId: clientInfo.accountId,
    //     lastConnected: new Date().toISOString()
    //   }, null, 2)
    // );
    
    // console.info(`Client info saved to ${clientInfoFile}`);
  });
  
  // Listen for message events
  client.on('message', (message) => {
    // Display basic message info
    console.info(`New message from ${message.from}: ${message.content}`);
    
    // Display special message types more clearly
    if (message.type === 'deleted') {
      console.info(`This message is a deletion notification`);
    } else if (message.type === 'reaction') {
      console.info(`This message is a reaction: ${message.content}`);
    }
    
    // Display reply context if this is a reply
    if (message.isReply) {
      console.info(`This message is a reply to: "${message.replyToMessage}"`);
      console.info(`Original message ID: ${message.replyToMessageId}`);
      console.info(`Original sender: ${message.replyToParticipant}`);
    }
    
    // Handle media messages - demonstrate optional download
    if (['image', 'video', 'audio', 'document'].includes(message.type)) {
      console.info(`Received media message of type: ${message.type}`);
      
      // Display caption if present
      if (message.caption) {
        console.info(`Caption: "${message.caption}"`);
      }
      
      // Example: Only download images and documents automatically
      if (['image', 'document'].includes(message.type)) {
        console.info('Downloading media content...');
        client.downloadMedia(message)
          .then(mediaPath => {
            if (mediaPath) {
              console.info(`Media downloaded successfully to: ${mediaPath}`);
            } else {
              console.error('Failed to download media');
            }
          })
          .catch(err => console.error(`Error downloading media: ${err}`));
      } else {
        console.info('Media available for download but not automatically downloaded');
        // Example: You could provide a function to download on demand
        // downloadMediaLater(message);
      }
    }
  });
  
  // Listen for media download events
  client.on('media', ({ message, path }) => {
    console.info(`Media from ${message.from} downloaded successfully to: ${path}`);
    console.info(`Media type: ${message.type}, File name: ${message.fileName || path.split('/').pop()}`);
    
    // Display caption if present
    if (message.caption) {
      console.info(`Caption: "${message.caption}"`);
    }
  });
  
  // Example function to download media later when needed
  function downloadMediaLater(message: any) {
    // This could be triggered by a user action or other event
    console.info('Downloading media on demand...');
    client.downloadMedia(message)
      .then(mediaPath => {
        if (mediaPath) {
          console.info(`Media downloaded on demand to: ${mediaPath}`);
        }
      })
      .catch(err => console.error(`Error downloading media on demand: ${err}`));
  }
  
  // Listen for error events
  client.on('error', (error) => {
    console.error(`Client error: ${error}`);
  });
}

main().catch((error) => console.error(`Unhandled error: ${error}`));