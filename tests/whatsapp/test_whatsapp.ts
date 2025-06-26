// main.ts
import { WhatsAppSession } from '../../src/lib/server/whatsapp/WhatsAppSession';

(async () => {
  // const session = new WhatsAppSession("auth", "cfa9558e-5a77-492a-8e8d-a02ea7dae1bc");
  const session = new WhatsAppSession("auth", "7bc6e217-9dec-476a-bc77-f6f509f54f03");
  await session.init();

  // Optional: Send a message
  // await session.sendMessage('123456789@s.whatsapp.net', { text: 'Hello from class!' });

  // Shutdown gracefully when needed
  // await session.shutdown();
})();
