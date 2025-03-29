//Node App to hello world using baileys
import { whatsAppAccountManager } from '../../src/lib/server/whatsapp/WhatsAppAccountManager';
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
    
    // Create a new WhatsApp client
    console.info('Creating WhatsApp client...');
    const { clientId, qrCodePromise } = await whatsAppAccountManager.createClient(phoneNumber, accountId);
    
    console.info(`WhatsApp client created with ID: ${clientId}`);
    console.info('Waiting for QR code...');
    
    // Get the client instance immediately to set up QR code handling
    const client = whatsAppAccountManager.getClient(clientId);
    if (!client) {
      throw new Error(`Failed to get client with ID: ${clientId}`);
    }
    
    // Set up QR code refresh handling
    let lastQrCode = '';
    client.on('qr', (qrCode) => {
      // Only display if it's a new QR code
      if (qrCode !== lastQrCode) {
        lastQrCode = qrCode;
        console.log('\nNew QR code received. Scan this QR code with your WhatsApp app:\n');
        qrcode.generate(qrCode, { small: true });
      }
    });
    
    // Wait for the initial QR code
    const initialQrCode = await qrCodePromise;
    lastQrCode = initialQrCode;
    
    // We don't need to display the QR code here again as it will be displayed by the event handler above
    
    console.info('\nWaiting for connection...');
    
    // Client instance already obtained above
    
    // Set up event listeners directly on the client
    client.on('state', (state) => {
      console.info(`Client state changed: ${state}`);
      
      if (state === 'connected') {
        console.info('Client connected successfully!');
        
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
      }
    });
    
    client.on('message', (message) => {
      console.info(`New message from ${message.from}: ${message.content}`);
    });
    
    client.on('error', (error) => {
      console.error(`Client error: ${error}`);
    });
    
    // Keep the process running to maintain the connection
    process.stdin.resume();
    console.info('Press Ctrl+C to exit');
    
  } catch (error) {
    console.error(`Error in main function: ${error}`);
  }
}

// Run the main function
main().catch((error) => console.error(`Unhandled error: ${error}`));