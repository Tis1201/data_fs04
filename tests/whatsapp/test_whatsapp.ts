// main.ts
import { WhatsAppSession } from '../../src/lib/server/whatsapp/WhatsAppSession';
import { getTestPrisma } from './test-prisma';

// Use the simple file-based auth state instead of Prisma for this test
(async () => {

  const prisma = getTestPrisma();

  //delete all from whatsAppAuthData
  //   await prisma.whatsAppAuthData.deleteMany({});

  //count * from whatsAppAuthData
  const count = await prisma.whatsAppAuthData.count();
  console.log(`Total WhatsAppAuthData records: ${count}`);

  // Create a session with a specific ID for persistence
  const session = new WhatsAppSession(prisma, "7bc6e217-9dec-476a-bc77-f6f509f54f03");
  await session.init();

  // Optional: Send a message
  // await session.sendMessage('123456789@s.whatsapp.net', { text: 'Hello from class!' });

  // Keep the process running to maintain the connection
  console.log('WhatsApp session initialized. Press Ctrl+C to exit.');
})();
