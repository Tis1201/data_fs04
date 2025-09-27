import type { InMessage } from '../interfaces/message';
import type { Handler } from '../interfaces/handler';
import { logger } from '$lib/server/logger';
import { handleDeviceMessage } from './device/messageHandler';

export const webrtcHandler: Handler = {
  supports(type: string): boolean {
    return type === 'webrtc';
  },

  async handle(message: InMessage): Promise<void> {
    console.log(`[WebRTCHandler] ===== WEBRTC HANDLER CALLED =====`);
    console.log(`[WebRTCHandler] Full message received:`, JSON.stringify(message, null, 2));
    
    // For now, delegate to the device message handler since it already handles webrtc: messages
    // This maintains the existing logic while providing a dedicated handler
    await handleDeviceMessage(message);
    
    console.log(`[WebRTCHandler] WebRTC message processed successfully`);
  }
};
