/**
 * Clean Message Router
 * 
 * Centralized message routing that replaces the messy dispatcher.
 * Provides clean separation of concerns for message routing.
 */

import type { InMessage } from '../messaging/interfaces/message';
import { MessageValidator, MessageRouter as MessageRouterUtil } from '../../types/unified';
import { getLoggingManager } from '../../managers/LoggingManager';
import { webrtcHandler } from './WebRTCHandler';
import { terminalHandler } from './TerminalHandler';
import { rdpHandler } from './RDPHandler';
import { deviceHandler } from './DeviceHandler';

// ============================================================================
// MESSAGE ROUTER CLASS
// ============================================================================

class MessageRouterClass {
  private logger = getLoggingManager();
  private handlers = [
    webrtcHandler,
    terminalHandler,
    rdpHandler,
    deviceHandler
  ];

  /**
   * Route a message to the appropriate handler
   */
  async route(message: InMessage): Promise<void> {
    this.logger?.info('communication', 'Routing message', { 
      type: message.type,
      scope: message.scope
    });

    try {
      // Validate message
      if (!MessageValidator.validate(message)) {
        this.logger?.error('communication', 'Invalid message format', { message });
        throw new Error('Invalid message format');
      }

      // Find appropriate handler
      const handler = this.findHandler(message);
      if (!handler) {
        this.logger?.warn('communication', 'No handler found for message', { 
          type: message.type,
          payloadType: (message as any)?.payload?.type
        });
        return;
      }

      // Route to handler
      await handler.handle(message);
      
      this.logger?.info('communication', 'Message routed successfully', {
        type: message.type,
        scope: message.scope
      });
    } catch (error) {
      this.logger?.error('communication', 'Failed to route message', { error, message });
      throw error;
    }
  }

  /**
   * Find the appropriate handler for a message
   */
  private findHandler(message: InMessage): any {
    for (const handler of this.handlers) {
      if (handler.supports(message.type)) {
        return handler;
      }
    }
    return null;
  }

  /**
   * Get handler statistics
   */
  getStats(): Record<string, any> {
    return {
      totalHandlers: this.handlers.length,
      handlers: this.handlers.map(handler => ({
        name: handler.constructor.name,
        supports: handler.supports.toString()
      }))
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const messageRouter = new MessageRouterClass();
