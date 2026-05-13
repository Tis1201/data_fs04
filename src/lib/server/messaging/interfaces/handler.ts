import type { InMessage } from './message';

export interface Handler {
  /**
   * Handles an incoming message of a certain type.
   * @param message - the message received
   */
  handle(in_message: InMessage): Promise<void>;

  /**
   * Returns true if this handler supports the given message type.
   * e.g. "chat:msg", "webrtc:offer"
   */
  supports(type: string): boolean;
}
