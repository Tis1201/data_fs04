/**
 * Unified Store Manager
 * 
 * Centralized state management that replaces the messy multiple stores
 * (device-store, webrtc-store, websocket-store, sse-store).
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';
import type { 
  UnifiedMessage, 
  WebRTCMessage, 
  TerminalMessage, 
  RDPMessage, 
  DeviceMessage,
  SystemMessage,
  ErrorMessage
} from '../types/unified';
import { createCommunicationManager, type CommunicationConfig } from './CommunicationManager';

// ============================================================================
// INTERFACES
// ============================================================================

export interface WebRTCState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  peerConnection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  dataChannelStatus: 'closed' | 'connecting' | 'open' | 'closing';
  videoStream: MediaStream | null;
  latestMessage: WebRTCMessage | null;
  error: string | null;
}

export interface TerminalState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  terminalInstance: any | null;
  messages: TerminalMessage[];
  latestMessage: TerminalMessage | null;
  error: string | null;
}

export interface RDPState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  videoElement: HTMLVideoElement | null;
  videoStream: MediaStream | null;
  latestMessage: RDPMessage | null;
  error: string | null;
}

export interface DeviceState {
  deviceId: string | null;
  name: string | null;
  deviceType: string | null;
  status: 'online' | 'offline' | 'error' | null;
  connected: boolean;
  connectedAt: string | null;
  disconnectedAt: string | null;
  latestMessage: DeviceMessage | null;
  error: string | null;
}

export interface SystemState {
  notifications: SystemMessage[];
  logs: SystemMessage[];
  error: string | null;
}

export interface UnifiedState {
  communication: {
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
    error: string | null;
    connectionType: 'sse' | 'pushpin' | null;
  };
  webrtc: WebRTCState;
  terminal: TerminalState;
  rdp: RDPState;
  device: DeviceState;
  system: SystemState;
}

// ============================================================================
// INITIAL STATES
// ============================================================================

const initialWebRTCState: WebRTCState = {
  connectionStatus: 'disconnected',
  peerConnection: null,
  dataChannel: null,
  dataChannelStatus: 'closed',
  videoStream: null,
  latestMessage: null,
  error: null
};

const initialTerminalState: TerminalState = {
  connectionStatus: 'disconnected',
  terminalInstance: null,
  messages: [],
  latestMessage: null,
  error: null
};

const initialRDPState: RDPState = {
  connectionStatus: 'disconnected',
  videoElement: null,
  videoStream: null,
  latestMessage: null,
  error: null
};

const initialDeviceState: DeviceState = {
  deviceId: null,
  name: null,
  deviceType: null,
  status: null,
  connected: false,
  connectedAt: null,
  disconnectedAt: null,
  latestMessage: null,
  error: null
};

const initialSystemState: SystemState = {
  notifications: [],
  logs: [],
  error: null
};

const initialState: UnifiedState = {
  communication: {
    status: 'disconnected',
    error: null,
    connectionType: null
  },
  webrtc: initialWebRTCState,
  terminal: initialTerminalState,
  rdp: initialRDPState,
  device: initialDeviceState,
  system: initialSystemState
};

// ============================================================================
// STORE MANAGER CLASS
// ============================================================================

class StoreManagerClass {
  private state: Writable<UnifiedState>;
  private communicationManager: any = null;
  private isInitialized = false;

  constructor() {
    this.state = writable(initialState);
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the store manager
   */
  async initialize(config: CommunicationConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('[StoreManager] Already initialized');
      return;
    }

    if (!browser) {
      console.warn('[StoreManager] Not running in browser, skipping initialization');
      return;
    }

    try {
      // Create communication manager
      this.communicationManager = createCommunicationManager(config);
      
      // Subscribe to communication state
      this.communicationManager.subscribe((commState: any) => {
        this.updateState({
          communication: {
            status: commState.status,
            error: commState.error,
            connectionType: commState.connectionType
          }
        });
      });

      // Set up message handlers
      this.setupMessageHandlers();

      // Connect to communication channel
      await this.communicationManager.connect();

      this.isInitialized = true;
      console.log('[StoreManager] Initialized successfully');
    } catch (error) {
      console.error('[StoreManager] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe = this.state.subscribe;

  /**
   * Get current state
   */
  getCurrentState(): UnifiedState {
    let state: UnifiedState;
    this.state.subscribe(s => state = s)();
    return state!;
  }

  /**
   * Update specific part of state
   */
  updateState(updates: Partial<UnifiedState>): void {
    this.state.update(current => {
      const newState = { ...current };
      
      // Deep merge updates
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof UnifiedState]) {
          (newState as any)[key] = {
            ...(current as any)[key],
            ...(updates as any)[key]
          };
        }
      });
      
      return newState;
    });
  }

  /**
   * Send a message
   */
  async sendMessage(message: UnifiedMessage): Promise<void> {
    if (!this.communicationManager) {
      throw new Error('StoreManager not initialized');
    }
    return this.communicationManager.send(message);
  }

  /**
   * Set device information
   */
  setDevice(device: Partial<DeviceState>): void {
    this.updateState({
      device: {
        ...this.getCurrentState().device,
        ...device
      }
    });
  }

  /**
   * Set WebRTC state
   */
  setWebRTC(webrtc: Partial<WebRTCState>): void {
    this.updateState({
      webrtc: {
        ...this.getCurrentState().webrtc,
        ...webrtc
      }
    });
  }

  /**
   * Set Terminal state
   */
  setTerminal(terminal: Partial<TerminalState>): void {
    this.updateState({
      terminal: {
        ...this.getCurrentState().terminal,
        ...terminal
      }
    });
  }

  /**
   * Set RDP state
   */
  setRDP(rdp: Partial<RDPState>): void {
    this.updateState({
      rdp: {
        ...this.getCurrentState().rdp,
        ...rdp
      }
    });
  }

  /**
   * Add system notification
   */
  addNotification(notification: SystemMessage): void {
    this.updateState({
      system: {
        ...this.getCurrentState().system,
        notifications: [
          ...this.getCurrentState().system.notifications,
          notification
        ]
      }
    });
  }

  /**
   * Add system log
   */
  addLog(log: SystemMessage): void {
    this.updateState({
      system: {
        ...this.getCurrentState().system,
        logs: [
          ...this.getCurrentState().system.logs,
          log
        ]
      }
    });
  }

  /**
   * Clear notifications
   */
  clearNotifications(): void {
    this.updateState({
      system: {
        ...this.getCurrentState().system,
        notifications: []
      }
    });
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.updateState({
      system: {
        ...this.getCurrentState().system,
        logs: []
      }
    });
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.state.set(initialState);
  }

  /**
   * Destroy the store manager
   */
  async destroy(): Promise<void> {
    if (this.communicationManager) {
      await this.communicationManager.disconnect();
      this.communicationManager = null;
    }
    this.isInitialized = false;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setupMessageHandlers(): void {
    if (!this.communicationManager) return;

    // WebRTC messages
    this.communicationManager.on('webrtc', (message: WebRTCMessage) => {
      this.handleWebRTCMessage(message);
    });

    // Terminal messages
    this.communicationManager.on('terminal', (message: TerminalMessage) => {
      this.handleTerminalMessage(message);
    });

    // RDP messages
    this.communicationManager.on('rdp', (message: RDPMessage) => {
      this.handleRDPMessage(message);
    });

    // Device messages
    this.communicationManager.on('device', (message: DeviceMessage) => {
      this.handleDeviceMessage(message);
    });

    // System messages
    this.communicationManager.on('system', (message: SystemMessage) => {
      this.handleSystemMessage(message);
    });

    // Error messages
    this.communicationManager.on('error', (message: ErrorMessage) => {
      this.handleErrorMessage(message);
    });
  }

  private handleWebRTCMessage(message: WebRTCMessage): void {
    console.log('[StoreManager] Handling WebRTC message:', message);
    
    this.updateState({
      webrtc: {
        ...this.getCurrentState().webrtc,
        latestMessage: message,
        error: message.data.error || null
      }
    });
  }

  private handleTerminalMessage(message: TerminalMessage): void {
    console.log('[StoreManager] Handling Terminal message:', message);
    
    const currentState = this.getCurrentState();
    const newMessages = [...currentState.terminal.messages, message];
    
    this.updateState({
      terminal: {
        ...currentState.terminal,
        messages: newMessages,
        latestMessage: message,
        error: message.data.error || null
      }
    });
  }

  private handleRDPMessage(message: RDPMessage): void {
    console.log('[StoreManager] Handling RDP message:', message);
    
    this.updateState({
      rdp: {
        ...this.getCurrentState().rdp,
        latestMessage: message,
        error: message.data.error || null
      }
    });
  }

  private handleDeviceMessage(message: DeviceMessage): void {
    console.log('[StoreManager] Handling Device message:', message);
    
    this.updateState({
      device: {
        ...this.getCurrentState().device,
        latestMessage: message,
        error: message.data.error || null
      }
    });
  }

  private handleSystemMessage(message: SystemMessage): void {
    console.log('[StoreManager] Handling System message:', message);
    
    if (message.action === 'notification') {
      this.addNotification(message);
    } else if (message.action === 'log') {
      this.addLog(message);
    }
  }

  private handleErrorMessage(message: ErrorMessage): void {
    console.error('[StoreManager] Handling Error message:', message);
    
    // Add error to system logs
    this.addLog({
      id: message.id,
      type: 'system',
      action: 'log',
      deviceId: message.deviceId,
      data: {
        level: 'error',
        message: message.data.message,
        details: message.data.details
      },
      timestamp: message.timestamp
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let storeManagerInstance: StoreManagerClass | null = null;

export function createStoreManager(): StoreManagerClass {
  if (storeManagerInstance) {
    return storeManagerInstance;
  }
  
  storeManagerInstance = new StoreManagerClass();
  return storeManagerInstance;
}

export function getStoreManager(): StoreManagerClass | null {
  return storeManagerInstance;
}

export function destroyStoreManager(): void {
  if (storeManagerInstance) {
    storeManagerInstance.destroy();
    storeManagerInstance = null;
  }
}

// ============================================================================
// DERIVED STORES
// ============================================================================

export function createDerivedStores(storeManager: StoreManagerClass) {
  const state = storeManager.subscribe;
  
  return {
    // Communication state
    communication: derived(state, $state => $state.communication),
    
    // WebRTC state
    webrtc: derived(state, $state => $state.webrtc),
    
    // Terminal state
    terminal: derived(state, $state => $state.terminal),
    
    // RDP state
    rdp: derived(state, $state => $state.rdp),
    
    // Device state
    device: derived(state, $state => $state.device),
    
    // System state
    system: derived(state, $state => $state.system),
    
    // Connection status
    isConnected: derived(state, $state => $state.communication.status === 'connected'),
    
    // Has errors
    hasErrors: derived(state, $state => 
      $state.communication.error !== null ||
      $state.webrtc.error !== null ||
      $state.terminal.error !== null ||
      $state.rdp.error !== null ||
      $state.device.error !== null ||
      $state.system.error !== null
    )
  };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function initializeStore(config: CommunicationConfig): Promise<StoreManagerClass> {
  const manager = createStoreManager();
  await manager.initialize(config);
  return manager;
}

export function getState(): UnifiedState {
  const manager = getStoreManager();
  return manager ? manager.getCurrentState() : initialState;
}

export async function sendMessage(message: UnifiedMessage): Promise<void> {
  const manager = getStoreManager();
  if (!manager) {
    throw new Error('StoreManager not initialized');
  }
  return manager.sendMessage(message);
}
