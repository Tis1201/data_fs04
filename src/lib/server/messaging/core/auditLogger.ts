import type { RoutingMessage, OutMessage } from '../interfaces/message';
import type { UserInfo } from '$lib/server/types/user';
import { logger } from '$lib/server/logger';

/**
 * Interface for message trace entries
 */
export interface MessageTrace {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  authorized: boolean;
  status: 'success' | 'error';
  messageType: string;
  messageScope: string;
  payloadType?: string;
  error?: string;
  connectionId?: string;
  protocol?: string;
  sudo?: boolean;
}

/**
 * AuditLogger for messaging system
 * Captures trace information about message flow for debugging and monitoring
 */
export class AuditLogger {
  private static traces: MessageTrace[] = [];
  private static maxTraces = 100; // Limit the number of traces stored in memory
  
  // Initialize on module load
  static {
    try {
      this.loadTraces();
      logger.debug('AuditLogger initialized');
    } catch (err) {
      logger.error(`Failed to initialize AuditLogger: ${err}`);
    }
  }

  /**
   * Log a message trace entry
   */
  static logTrace(trace: MessageTrace): void {
    // Add to the beginning for most recent first
    this.traces.unshift(trace);
    
    // Trim if exceeding max size
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(0, this.maxTraces);
    }

    // Also log to the regular logger for server logs
    logger.debug(`[MessageTrace] ${trace.status === 'success' ? '✓' : '✗'} ${trace.from} → ${trace.to} | ${trace.authorized ? 'AUTH' : 'UNAUTH'} | ${trace.messageType}:${trace.payloadType || 'unknown'}`);

    this.saveTraces();
  }

  /**
   * Log a successful message delivery
   */
  static logSuccess(message: RoutingMessage, recipientId: string): void {
    const { userInfo, type, scope, payload, connectionId, protocol, sudo } = message;

    this.logTrace({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userInfo.id,
      to: recipientId,
      authorized: true,
      status: 'success',
      messageType: type,
      messageScope: scope,
      payloadType: (payload as any).type,
      connectionId,
      protocol,
      sudo
    });
  }

  /**
   * Log an authorization failure
   */
  static logAuthFailure(message: RoutingMessage, recipientId: string): void {
    const { userInfo, type, scope, payload } = message;

    this.logTrace({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userInfo.id,
      to: recipientId,
      authorized: false,
      status: 'error',
      messageType: type,
      messageScope: scope,
      payloadType: (payload as any).type,
      error: 'Not authorized'
    });
  }

  /**
   * Log a delivery error
   */
  static logDeliveryError(message: RoutingMessage, recipientId: string, error: Error): void {
    const { userInfo, type, scope, payload } = message;

    this.logTrace({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userInfo.id,
      to: recipientId,
      authorized: true,
      status: 'error',
      messageType: type,
      messageScope: scope,
      payloadType: (payload as any).type,
      error: error.message
    });
  }

  /**
   * Get all traces for debugging
   */
  static getTraces(): MessageTrace[] {
    return [...this.traces];
  }

  /**
   * Clear all traces
   */
  static clearTraces(): void {
    this.traces = [];
    this.saveTraces();
  }

  /**
   * Save traces to storage
   */
  private static saveTraces(): void {
    try {
      // Use node's global object to store traces between requests
      // This is a simple in-memory persistence that survives between requests
      (global as any).__MESSAGE_TRACES__ = this.traces;
    } catch (err) {
      logger.error(`Failed to save message traces: ${err}`);
    }
  }

  /**
   * Load traces from storage
   */
  private static loadTraces(): void {
    try {
      // Retrieve traces from global object
      const storedTraces = (global as any).__MESSAGE_TRACES__;
      if (Array.isArray(storedTraces)) {
        this.traces = storedTraces;
        logger.debug(`Loaded ${this.traces.length} message traces from storage`);
      }
    } catch (err) {
      logger.error(`Failed to load message traces: ${err}`);
    }
  }
}
