// main.ts
import { WhatsAppSession } from '../../src/lib/server/whatsapp/WhatsAppSession';
import { getTestPrisma } from './test-prisma';

// Use the simple file-based auth state instead of Prisma for this test
(async () => {

  const prisma = getTestPrisma();

  // delete all from whatsAppAuthData
    await prisma.whatsAppAuthData.deleteMany({});

  //count * from whatsAppAuthData
  const count = await prisma.whatsAppAuthData.count();
  console.log(`Total WhatsAppAuthData records: ${count}`);

    // Create a session with a specific ID for persistence
  const session = new WhatsAppSession(prisma, "7bc6e217-9dec-476a-bc77-f6f509f54f11");
  
  // Set up event listeners
  session.on('qrcode', (qr) => {
    console.log('\n=== QR Code Received ===');
    console.log(qr);
    console.log('========================\n');
  });

  session.on('authenticated', ({ pushName, phoneNumber }) => {
    console.log(`✅ Session authenticated successfully as ${pushName} (${phoneNumber})`);
  });

  session.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
  });

  session.on('ready', () => {
    console.log('🚀 WhatsApp client is ready!');
    console.log('Session info:', session.getInfo());
  });

  session.on('disconnected', (reason) => {
    console.warn('⚠️  Disconnected:', reason);
  });

  session.on('message', (msg) => {
    console.log('\n📨 New message:');
    // console.log('From:', msg.key.remoteJid);
    // console.log('Message content:', JSON.stringify(msg.message, null, 2));
  });

  session.on('error', (error) => {
    console.error('❌ Error:', error);
  });

  try {
    console.log('🔌 Initializing WhatsApp session...');
    await session.init();
  } catch (error) {
    console.error('Failed to initialize session:', error);
    process.exit(1);
  }

  // Optional: Send a message
  // await session.sendMessage('123456789@s.whatsapp.net', { text: 'Hello from class!' });

  // Keep the process running to maintain the connection
  console.log('WhatsApp session initialized. Press Ctrl+C to exit.');
})();
