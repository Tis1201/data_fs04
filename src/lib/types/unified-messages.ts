/**
 * Unified Message Types and Structures
 * 
 * This file centralizes all message types and structures used across the system
 * to ensure consistency between server, device, and frontend communication.
 */

// ============================================================================
// CORE MESSAGE TYPES
// ============================================================================

export type MessageType = 
  | 'device:actionRequest'    // Server → Device (action commands)
  | 'device:statusUpdate'     // Server → Frontend (status updates)
  | 'device:progressUpdate'   // Server → Frontend (progress updates)
  | 'device:logLine'          // Server → Frontend (log streaming)
  | 'device:fileProgress'     // Server → Frontend (file transfer progress)
  | 'device:logsStatus'       // Server → Frontend (logs status updates)
  | 'device:response'         // Server → Frontend (device responses)
  | 'device'                  // Generic device messages
  | 'ping'                    // System ping
  | 'pong'                    // System pong
  | 'connected'               // Connection status
  | 'disconnected';           // Connection status

export type ActionType = 
  | 'reboot'
  | 'restart'
  | 'installApp'
  | 'pushFile'
  | 'pullFile'
  | 'updateFirmware'
  | 'getLogs'
  | 'bundleStatus';

export type ActionStatus = 
  | 'initiated'
  | 'in_progress'
  | 'complete'
  | 'failed';

// ============================================================================
// UNIFIED MESSAGE STRUCTURES
// ============================================================================

/**
 * Base message structure that all messages inherit from
 */
export interface BaseMessage {
  id: string;
  type: MessageType;
  scope: string;
  timestamp: string;
  senderId: string;
  requestId?: string;
}

/**
 * Device Action Request Message
 * Server → Device (action commands with logId)
 */
export interface DeviceActionRequestMessage extends BaseMessage {
  type: 'device:actionRequest';
  payload: {
    action: ActionType;
    deviceId: string;
    logId: string;
    requestId: string;
    [key: string]: any; // Additional action-specific data
  };
}

/**
 * Device Status Update Message
 * Server → Frontend (status updates with action info)
 */
export interface DeviceStatusUpdateMessage extends BaseMessage {
  type: 'device:statusUpdate';
  payload: {
    logId: string;
    action: ActionType;
    status: ActionStatus;
    message: string;
    durationMs?: number; // Server-calculated duration in milliseconds
    timestamp: string;
  };
}

/**
 * Device Progress Update Message
 * Server → Frontend (progress updates for long-running actions)
 */
export interface DeviceProgressUpdateMessage extends BaseMessage {
  type: 'device:progressUpdate';
  payload: {
    logId: string;
    action: ActionType;
    progress: number; // 0-100
    message: string;
    timestamp: string;
  };
}

/**
 * Device Log Line Message
 * Server → Frontend (real-time log streaming)
 */
export interface DeviceLogLineMessage extends BaseMessage {
  type: 'device:logLine';
  payload: {
    logId: string;
    line: string;
    timestamp: string;
  };
}

/**
 * Device File Progress Message
 * Server → Frontend (file transfer progress)
 */
export interface DeviceFileProgressMessage extends BaseMessage {
  type: 'device:fileProgress';
  payload: {
    logId: string;
    action: 'pushFile' | 'pullFile';
    progress: number; // 0-100
    message: string;
    bytesTransferred?: number;
    totalBytes?: number;
    timestamp: string;
  };
}

/**
 * Union type for all device messages
 */
export type DeviceMessage = 
  | DeviceActionRequestMessage
  | DeviceStatusUpdateMessage
  | DeviceProgressUpdateMessage
  | DeviceLogLineMessage
  | DeviceFileProgressMessage;

// ============================================================================
// API RESPONSE STRUCTURES
// ============================================================================

/**
 * Unified Action API Response
 * POST /api/devices/{id}/actions
 */
export interface ActionApiResponse {
  success: true;
  data: {
    operationId: string;
    deviceId: string;
    action: ActionType;
    status: 'initiated';
    message: string;
    payload: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}

/**
 * Device Status API Response
 * POST /api/devices/{id}/status
 */
export interface DeviceStatusApiResponse {
  success: true;
  data: {
    logId: string;
    action: ActionType;
    status: ActionStatus;
    message: string;
    timestamp: string;
  };
}

// ============================================================================
// MESSAGE PARSING UTILITIES
// ============================================================================

/**
 */
export function parseMessage(rawMessage: any): DeviceMessage | null {
  try {
    const message = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    
    if (!message.type || !message.payload) {
      return null;
    }

    // Validate message type
    const validTypes: MessageType[] = [
      'device:actionRequest',
      'device:statusUpdate', 
      'device:progressUpdate',
      'device:logLine',
      'device:fileProgress',
      'device:logsStatus',
      'device:response',
      'device',
      'ping',
      'pong',
      'connected',
      'disconnected'
    ];

    if (!validTypes.includes(message.type)) {
      return null;
    }

    return message as DeviceMessage;
  } catch (error) {
    console.error('[MessageParser] Failed to parse message:', error);
    return null;
  }
}

/**
 * Extract action type from a device message
 */
export function extractActionFromMessage(message: DeviceMessage): ActionType | null {
  if ('payload' in message && 'action' in message.payload) {
    return message.payload.action as ActionType;
  }
  return null;
}

/**
 * Check if a message is a status update
 */
export function isStatusUpdateMessage(message: DeviceMessage): message is DeviceStatusUpdateMessage {
  return message.type === 'device:statusUpdate';
}

/**
 * Check if a message is a progress update
 */
export function isProgressUpdateMessage(message: DeviceMessage): message is DeviceProgressUpdateMessage {
  return message.type === 'device:progressUpdate';
}

/**
 * Check if a message is a log line
 */
export function isLogLineMessage(message: DeviceMessage): message is DeviceLogLineMessage {
  return message.type === 'device:logLine';
}
