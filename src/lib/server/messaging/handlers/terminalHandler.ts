import type { InMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { logger } from '$lib/server/logger';
import { handleDeviceMessage } from './device';

export const terminalHandler: Handler = {
  supports(type: string): boolean {
    return type === 'terminal';
  },

  async handle(message: InMessage): Promise<void> {
    console.log(`[TerminalHandler] ===== TERMINAL HANDLER CALLED =====`);
    console.log(`[TerminalHandler] Full message received:`, JSON.stringify(message, null, 2));
    
    // For now, delegate to the device message handler since it already handles terminal: messages
    // This maintains the existing logic while providing a dedicated handler
    await handleDeviceMessage(message);
    
    console.log(`[TerminalHandler] Terminal message processed successfully`);
  }
};
