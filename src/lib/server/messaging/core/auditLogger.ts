import type { RoutingMessage, OutMessage, InMessage } from '../interfaces/message';
import type { UserInfo } from '$lib/server/types/user';
import { logger } from '$lib/server/logger';

// Maximum size of payload to store in traces (in characters)
const MAX_PAYLOAD_SIZE = 1000;

/**
 * Safely stringify an object with size limits
 */
function safeStringify(obj: any, maxSize: number = MAX_PAYLOAD_SIZE): string {
  try {
    // Handle common cases quickly
    if (obj === undefined) return 'undefined';
    if (obj === null) return 'null';
    if (typeof obj === 'string') return obj.length > maxSize ? obj.substring(0, maxSize) + '...' : obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    
    // For objects, try to stringify with a replacer to handle circular refs and large objects
    const seen = new WeakSet();
    const result = JSON.stringify(
      obj,
      (key, value) => {
        // Handle circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        
        // Handle large strings
        if (typeof value === 'string' && value.length > 100) {
          return value.substring(0, 100) + '...';
        }
        
        // Handle binary data
        if (value instanceof ArrayBuffer) return '[ArrayBuffer]';
        if (value instanceof Uint8Array) return `[Uint8Array ${value.length} bytes]`;
        
        return value;
      },
      2 // Indent with 2 spaces for pretty printing
    );
    
    // Truncate if still too large
    return result.length > maxSize ? result.substring(0, maxSize) + '...' : result;
  } catch (err) {
    return `[Error stringifying: ${err.message}]`;
  }
}

/**
 * Interface for message trace entries
 */
export type MessageDirection = 'IN' | 'OUT';

export interface MessageTrace {
  id: string;
  timestamp: string;
  from: string;           // User ID
  to: string;             // Recipient ID or 'system'
  userEmail?: string;     // User's email (from)
  recipientEmail?: string; // Recipient's email (to)
  direction: MessageDirection;  // IN for received, OUT for sent
  authorized: boolean;
  status: 'success' | 'error';
  messageType: string;
  messageScope: string;
  payloadType?: string;
  payloadPreview?: string;  // Preview of the payload
  payload?: any;            // Full message payload
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
    const payloadType = (payload as any)?.type || typeof payload;
    
    // Create a safe payload preview, excluding sensitive data
    let payloadPreview = '';
    if (payload) {
      const safePayload = { ...(payload as any) };
      
      // Redact potentially sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
      Object.keys(safePayload).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          safePayload[key] = '[REDACTED]';
        }
      });
      
      payloadPreview = safeStringify(safePayload);
    }

    this.logTrace({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userInfo.id,
      to: recipientId,
      userEmail: userInfo.email, // Add user email
      recipientEmail: (message as any).recipientEmail, // Add recipient email if available
      direction: 'OUT', // Outgoing message
      authorized: true,
      status: 'success',
      messageType: type,
      messageScope: scope,
      payloadType,
      payloadPreview,
      payload,  // Include the full payload
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
    const payloadType = (payload as any)?.type || typeof payload;
    
    // Create a safe payload preview, excluding sensitive data
    let payloadPreview = '';
    if (payload) {
      const safePayload = { ...(payload as any) };
      
      // Redact potentially sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
      Object.keys(safePayload).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          safePayload[key] = '[REDACTED]';
        }
      });
      
      payloadPreview = safeStringify(safePayload);
    }

    this.logTrace({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userInfo.id,
      to: recipientId,
      userEmail: userInfo.email, // Add user email
      recipientEmail: (message as any).recipientEmail, // Add recipient email if available
      direction: 'OUT', // Outgoing message (failed authorization)
      authorized: false,
      status: 'error',
      messageType: type,
      messageScope: scope,
      payloadType,
      payloadPreview,
      payload,  // Include the full payload
      error: 'Not authorized'
    });
  }

  /**
   * Log a received message
   */
  static logReceived(message: InMessage): void {
    const { userInfo, type, scope, payload, connectionId, protocol } = message;
    const payloadType = (payload as any)?.type || typeof payload;
    
    // Create a safe payload preview, excluding sensitive data
    let payloadPreview = '';
    if (payload) {
      const safePayload = { ...(payload as any) };
      
      // Redact potentially sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
      Object.keys(safePayload).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          safePayload[key] = '[REDACTED]';
        }
      });
      
      payloadPreview = safeStringify(safePayload);
    }

    this.logTrace({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userInfo.id,
      to: 'system', // Received by the system
      userEmail: userInfo.email, // Add user email
      direction: 'IN', // Always IN for received messages
      authorized: true, // Assume received messages are authorized at this stage
      status: 'success',
      messageType: type,
      messageScope: scope,
      payloadType,
      payloadPreview,
      payload, // Include the full payload
      connectionId,
      protocol,
      sudo: message.sudo || false
    });
  }

  /**
   * Log a delivery error
   */
  static logDeliveryError(message: RoutingMessage, recipientId: string, error: Error): void {
    const { userInfo, type, scope, payload } = message;
    const payloadType = (payload as any)?.type || typeof payload;
    
    // Create a safe payload preview, excluding sensitive data
    let payloadPreview = '';
    if (payload) {
      const safePayload = { ...(payload as any) };
      
      // Redact potentially sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'authorization'];
      Object.keys(safePayload).forEach(key => {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          safePayload[key] = '[REDACTED]';
        }
      });
      
      payloadPreview = safeStringify(safePayload);
    }

    this.logTrace({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userInfo.id,
      to: recipientId,
      userEmail: userInfo.email, // Add user email
      recipientEmail: (message as any).recipientEmail, // Add recipient email if available
      direction: 'OUT', // Outgoing message (delivery failed)
      authorized: true,
      status: 'error',
      messageType: type,
      messageScope: scope,
      payloadType,
      payloadPreview,
      payload,  // Include the full payload
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
