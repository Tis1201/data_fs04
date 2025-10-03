/**
 * Unified Message Type System
 * 
 * This file defines the standardized message types used across the entire application
 * for WebRTC, Terminal, RDP, and general device communication.
 */

// ============================================================================
// BASE MESSAGE TYPES
// ============================================================================

export interface BaseMessage {
  id: string;
  type: MessageType;
  timestamp: number;
  deviceId: string;
  userId?: string;
  requestId?: string;
  connectionId?: string;
  protocol?: 'websocket' | 'sse' | 'pushpin';
}

export type MessageType = 
  | 'webrtc'
  | 'terminal' 
  | 'rdp'
  | 'device'
  | 'system'
  | 'error';

// ============================================================================
// WEBRTC MESSAGE TYPES
// ============================================================================

export interface WebRTCMessage extends BaseMessage {
  type: 'webrtc';
  action: WebRTCAction;
  data: WebRTCData;
}

export type WebRTCAction = 
  | 'connect'
  | 'disconnect'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'error';

export interface WebRTCData {
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  error?: string;
  connectionState?: 'connecting' | 'connected' | 'disconnected' | 'failed';
  dataChannelState?: 'connecting' | 'open' | 'closing' | 'closed';
}

// ============================================================================
// TERMINAL MESSAGE TYPES
// ============================================================================

export interface TerminalMessage extends BaseMessage {
  type: 'terminal';
  action: TerminalAction;
  data: TerminalData;
}

export type TerminalAction = 
  | 'connect'
  | 'disconnect'
  | 'input'
  | 'output'
  | 'resize'
  | 'error';

export interface TerminalData {
  input?: string;
  output?: string;
  rows?: number;
  cols?: number;
  error?: string;
  connectionState?: 'connecting' | 'connected' | 'disconnected' | 'failed';
}

// ============================================================================
// RDP MESSAGE TYPES
// ============================================================================

export interface RDPMessage extends BaseMessage {
  type: 'rdp';
  action: RDPAction;
  data: RDPData;
}

export type RDPAction = 
  | 'start'
  | 'stop'
  | 'mouse'
  | 'keyboard'
  | 'error';

export interface RDPData {
  options?: RDPOptions;
  mouse?: MouseEventData;
  keyboard?: KeyboardEventData;
  error?: string;
  connectionState?: 'connecting' | 'connected' | 'disconnected' | 'failed';
  videoStream?: MediaStream | null;
}

export interface RDPOptions {
  quality?: 'low' | 'medium' | 'high';
  resolution?: { width: number; height: number };
  framerate?: number;
  captureMode?: 'screen' | 'test';
}

export interface MouseEventData {
  type: 'click' | 'move' | 'wheel' | 'right-click';
  x: number;
  y: number;
  button?: number;
  deltaX?: number;
  deltaY?: number;
}

export interface KeyboardEventData {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

// ============================================================================
// DEVICE MESSAGE TYPES
// ============================================================================

export interface DeviceMessage extends BaseMessage {
  type: 'device';
  action: DeviceAction;
  data: DeviceData;
}

export type DeviceAction = 
  | 'claim'
  | 'register'
  | 'status'
  | 'updateFirmware'
  | 'bundleStatus'
  | 'getLogs'
  | 'message'
  | 'error';

export interface DeviceData {
  deviceName?: string;
  deviceType?: string;
  status?: 'online' | 'offline' | 'error';
  connected?: boolean;
  connectedAt?: string;
  disconnectedAt?: string;
  firmwareVersion?: string;
  bundleStatus?: any;
  logs?: any;
  error?: string;
  message?: string;
}

// ============================================================================
// SYSTEM MESSAGE TYPES
// ============================================================================

export interface SystemMessage extends BaseMessage {
  type: 'system';
  action: SystemAction;
  data: SystemData;
}

export type SystemAction = 
  | 'status'
  | 'error'
  | 'notification'
  | 'log';

export interface SystemData {
  level?: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: any;
  category?: string;
}

// ============================================================================
// ERROR MESSAGE TYPES
// ============================================================================

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  action: 'error';
  data: ErrorData;
}

export interface ErrorData {
  code: string;
  message: string;
  details?: any;
  stack?: string;
  category?: 'network' | 'auth' | 'validation' | 'system' | 'device';
}

// ============================================================================
// UNIFIED MESSAGE UNION
// ============================================================================

export type UnifiedMessage = 
  | WebRTCMessage
  | TerminalMessage
  | RDPMessage
  | DeviceMessage
  | SystemMessage
  | ErrorMessage;

// ============================================================================
// MESSAGE FACTORY
// ============================================================================

export class MessageFactory {
  static createWebRTC(
    action: WebRTCAction,
    deviceId: string,
    data: WebRTCData,
    options: Partial<BaseMessage> = {}
  ): WebRTCMessage {
    return {
      id: this.generateId(),
      type: 'webrtc',
      action,
      deviceId,
      data,
      timestamp: Date.now(),
      ...options
    };
  }

  static createTerminal(
    action: TerminalAction,
    deviceId: string,
    data: TerminalData,
    options: Partial<BaseMessage> = {}
  ): TerminalMessage {
    return {
      id: this.generateId(),
      type: 'terminal',
      action,
      deviceId,
      data,
      timestamp: Date.now(),
      ...options
    };
  }

  static createRDP(
    action: RDPAction,
    deviceId: string,
    data: RDPData,
    options: Partial<BaseMessage> = {}
  ): RDPMessage {
    return {
      id: this.generateId(),
      type: 'rdp',
      action,
      deviceId,
      data,
      timestamp: Date.now(),
      ...options
    };
  }

  static createDevice(
    action: DeviceAction,
    deviceId: string,
    data: DeviceData,
    options: Partial<BaseMessage> = {}
  ): DeviceMessage {
    return {
      id: this.generateId(),
      type: 'device',
      action,
      deviceId,
      data,
      timestamp: Date.now(),
      ...options
    };
  }

  static createSystem(
    action: SystemAction,
    deviceId: string,
    data: SystemData,
    options: Partial<BaseMessage> = {}
  ): SystemMessage {
    return {
      id: this.generateId(),
      type: 'system',
      action,
      deviceId,
      data,
      timestamp: Date.now(),
      ...options
    };
  }

  static createError(
    deviceId: string,
    data: ErrorData,
    options: Partial<BaseMessage> = {}
  ): ErrorMessage {
    return {
      id: this.generateId(),
      type: 'error',
      action: 'error',
      deviceId,
      data,
      timestamp: Date.now(),
      ...options
    };
  }

  private static generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// MESSAGE VALIDATION
// ============================================================================

export class MessageValidator {
  static validate(message: any): message is UnifiedMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // Check required fields - handle both flat and nested structures
    const deviceId = message.deviceId || message.payload?.deviceId;
    const timestamp = message.timestamp || Date.now(); // Use current timestamp if not provided
    
    if (!message.type || !deviceId) {
      return false;
    }

    // Check message type
    if (!['webrtc', 'terminal', 'rdp', 'device', 'system', 'error'].includes(message.type)) {
      return false;
    }

    // Type-specific validation
    switch (message.type) {
      case 'webrtc':
        return this.validateWebRTC(message);
      case 'terminal':
        return this.validateTerminal(message);
      case 'rdp':
        return this.validateRDP(message);
      case 'device':
        return this.validateDevice(message);
      case 'system':
        return this.validateSystem(message);
      case 'error':
        return this.validateError(message);
      default:
        return false;
    }
  }

  private static validateWebRTC(message: any): message is WebRTCMessage {
    return message.action && 
           ['connect', 'disconnect', 'offer', 'answer', 'ice-candidate', 'error'].includes(message.action) &&
           message.data && typeof message.data === 'object';
  }

  private static validateTerminal(message: any): message is TerminalMessage {
    return message.action && 
           ['connect', 'disconnect', 'input', 'output', 'resize', 'error'].includes(message.action) &&
           message.data && typeof message.data === 'object';
  }

  private static validateRDP(message: any): message is RDPMessage {
    return message.action && 
           ['start', 'stop', 'mouse', 'keyboard', 'error'].includes(message.action) &&
           message.data && typeof message.data === 'object';
  }

  private static validateDevice(message: any): message is DeviceMessage {
    // Check if it's a nested payload structure (new format)
    if (message.payload && message.payload.action) {
      return ['claim', 'register', 'status', 'updateFirmware', 'bundleStatus', 'getLogs', 'message', 'error'].includes(message.payload.action) &&
             message.payload && typeof message.payload === 'object';
    }
    
    // Check if it's a flat structure (legacy format)
    return message.action && 
           ['claim', 'register', 'status', 'updateFirmware', 'bundleStatus', 'getLogs', 'message', 'error'].includes(message.action) &&
           (message.data && typeof message.data === 'object' || message.payload && typeof message.payload === 'object');
  }

  private static validateSystem(message: any): message is SystemMessage {
    return message.action && 
           ['status', 'error', 'notification', 'log'].includes(message.action) &&
           message.data && typeof message.data === 'object';
  }

  private static validateError(message: any): message is ErrorMessage {
    return message.action === 'error' &&
           message.data && 
           typeof message.data === 'object' &&
           message.data.code && 
           message.data.message;
  }
}

// ============================================================================
// MESSAGE ROUTING
// ============================================================================

export class MessageRouter {
  static getHandlerType(message: UnifiedMessage): string {
    return message.type;
  }

  static getActionType(message: UnifiedMessage): string {
    return `${message.type}:${message.action}`;
  }

  static shouldEcho(message: UnifiedMessage): boolean {
    // Messages that should be echoed back to sender
    return ['webrtc:offer', 'webrtc:answer', 'webrtc:ice-candidate'].includes(
      this.getActionType(message)
    );
  }

  static getScope(message: UnifiedMessage): string {
    return `subscription:device:${message.deviceId}`;
  }
}
