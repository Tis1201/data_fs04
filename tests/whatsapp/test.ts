//Node App to hello world using baileys
import { whatsAppAccountManager } from '../../src/lib/server/whatsapp/WhatsAppAccountManager';
import qrcode from 'qrcode-terminal';

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
    
    // Wait for the QR code
    const qrCodeData = await qrCodePromise;
    
    // Display the QR code in the terminal
    console.log('\nScan this QR code with your WhatsApp app:\n');
    qrcode.generate(qrCodeData, { small: true });
    
    console.info('\nWaiting for connection...');
    
    // Set up event listeners for the client
    whatsAppAccountManager.on('state', (id, state) => {
      if (id === clientId) {
        console.info(`Client state changed: ${state}`);
        
        if (state === 'connected') {
          console.info('Client connected successfully!');
          
          // Get client info
          const clientInfo = whatsAppAccountManager.getClientInfo(clientId);
          console.info('Client info:', clientInfo);
        }
      }
    });
    
    whatsAppAccountManager.on('message', (id, message) => {
      if (id === clientId) {
        console.info(`New message from ${message.from}: ${message.content}`);
      }
    });
    
    whatsAppAccountManager.on('error', (id, error) => {
      if (id === clientId) {
        console.error(`Client error: ${error}`);
      }
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