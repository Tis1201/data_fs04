import { mapActionToHandlerKey } from '$lib/client/actionHandlers/actionTypeMapping';

/**
 * Device Message Entity
 * 
 * This is the central entity that all device messages are mapped to.
 * It provides a single, consistent interface for message handling across the system.
 */

export interface DeviceMessageEntity {
  // Core message properties
  id: string;
  type: string;
  scope: string;
  timestamp: string;
  senderId: string;
  requestId?: string;
  
  // Action-specific properties
  action?: string;
  status?: string;
  message?: string;
  logId?: string;
  progress?: number;
  durationMs?: number;
  
  // Additional data
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Message Entity Mapper
 * 
 * Centralized mapping from raw messages to DeviceMessageEntity
 */
export class MessageEntityMapper {
  /**
   * Map any raw message to DeviceMessageEntity
   */
  static mapToEntity(rawMessage: any): DeviceMessageEntity | null {
    try {
      const message = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
      if (!message || !message.type) return null;

      const entity: DeviceMessageEntity = {
        id: message.id || '',
        type: message.type,
        scope: message.scope || '',
        timestamp: message.timestamp || new Date().toISOString(),
        senderId: message.senderId || 'unknown',
        requestId: message.requestId,
        payload: message.payload || {},
        metadata: message.metadata || {}
      };

      this.extractActionData(entity, message);
      return entity;
    } catch (error) {
      console.error('[MessageEntityMapper] Failed to map message to entity:', error);
      return null;
    }
  }

  /**
   * Extract action-specific data from the message
   */
  private static extractActionData(entity: DeviceMessageEntity, message: any): void {
    // Extract from payload first, then fallback to direct properties
    const payload = message.payload || {};
    
    // Action data
    entity.action = payload.action || message.action;
    
    // Status data
    entity.status = payload.status || message.status;
    
    // Message data
    entity.message = payload.message || message.message;
    
    // Log ID
    entity.logId = payload.logId || message.logId;
    
    // Progress
    entity.progress = payload.progress !== undefined ? payload.progress : message.progress;
    
    // Duration (server-calculated)
    entity.durationMs = payload.durationMs || message.durationMs;
    
    const objectPath = payload.objectPath || message.objectPath;
    entity.payload = {
      ...entity.payload,
      ...payload,
      ...(objectPath ? { objectPath } : {}),
      ...(message.deviceId ? { deviceId: message.deviceId } : {})
    };
  }

  /**
   * Check if entity represents a status update
   */
  static isStatusUpdate(entity: DeviceMessageEntity): boolean {
    return entity.type === 'device:statusUpdate' && !!entity.action && !!entity.status;
  }

  /**
   * Check if entity represents a progress update
   */
  static isProgressUpdate(entity: DeviceMessageEntity): boolean {
    return entity.type === 'device:progressUpdate' && !!entity.action && entity.progress !== undefined;
  }

  /**
   * Check if entity represents a log line
   */
  static isLogLine(entity: DeviceMessageEntity): boolean {
    return entity.type === 'device:logLine' && !!entity.logId;
  }

  /**
   * Check if entity represents a device action request
   */
  static isActionRequest(entity: DeviceMessageEntity): boolean {
    return entity.type === 'device:actionRequest' && !!entity.action;
  }

  /**
   * Get action type for routing
   */
  static getActionType(entity: DeviceMessageEntity): string | null {
    if (!entity.action) return null;
    return mapActionToHandlerKey(entity.action);
  }

  /**
   * Check if entity should be ignored (system messages, etc.)
   */
  static shouldIgnore(entity: DeviceMessageEntity): boolean {
    // Ignore system messages
    if (entity.type === 'ping' || entity.type === 'pong' || entity.type === 'connected' || entity.type === 'disconnected') {
      return true;
    }

    // Ignore device action requests (these are for the device, not frontend)
    if (entity.type === 'device:actionRequest') {
      return true;
    }

    // Ignore device connection status messages (these are handled by UI components, not action handlers)
    if (entity.type === 'device:connection') {
      return true;
    }

    return false;
  }
}
