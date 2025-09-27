/**
 * Unified Store
 * 
 * Single unified store that replaces the messy multiple stores
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
import { 
  createStoreManager, 
  type CommunicationConfig,
  type UnifiedState,
  type WebRTCState,
  type TerminalState,
  type RDPState,
  type DeviceState,
  type SystemState
} from '../managers/StoreManager';

// ============================================================================
// UNIFIED STORE CLASS
// ============================================================================

class UnifiedStoreClass {
  private storeManager: any = null;
  private isInitialized = false;

  constructor() {
    // Store will be initialized when StoreManager is available
  }

  /**
   * Initialize the unified store
   */
  async initialize(config: CommunicationConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('[UnifiedStore] Already initialized');
      return;
    }

    try {
      this.storeManager = createStoreManager();
      await this.storeManager.initialize(config);
      this.isInitialized = true;
      console.log('[UnifiedStore] Initialized successfully');
    } catch (error) {
      console.error('[UnifiedStore] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to the unified state
   */
  subscribe = (callback: (state: UnifiedState) => void) => {
    if (!this.storeManager) {
      console.warn('[UnifiedStore] StoreManager not initialized');
      return () => {};
    }
    return this.storeManager.subscribe(callback);
  };

  /**
   * Send a message
   */
  async sendMessage(message: UnifiedMessage): Promise<void> {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    return this.storeManager.sendMessage(message);
  }

  /**
   * Set device information
   */
  setDevice(device: Partial<DeviceState>): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.setDevice(device);
  }

  /**
   * Set WebRTC state
   */
  setWebRTC(webrtc: Partial<WebRTCState>): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.setWebRTC(webrtc);
  }

  /**
   * Set Terminal state
   */
  setTerminal(terminal: Partial<TerminalState>): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.setTerminal(terminal);
  }

  /**
   * Set RDP state
   */
  setRDP(rdp: Partial<RDPState>): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.setRDP(rdp);
  }

  /**
   * Add system notification
   */
  addNotification(notification: SystemMessage): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.addNotification(notification);
  }

  /**
   * Add system log
   */
  addLog(log: SystemMessage): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.addLog(log);
  }

  /**
   * Clear notifications
   */
  clearNotifications(): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.clearNotifications();
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.clearLogs();
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    if (!this.storeManager) {
      throw new Error('StoreManager not initialized');
    }
    this.storeManager.reset();
  }

  /**
   * Get current state
   */
  getCurrentState(): UnifiedState | null {
    if (!this.storeManager) {
      return null;
    }
    return this.storeManager.getCurrentState();
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Destroy the store
   */
  async destroy(): Promise<void> {
    if (this.storeManager) {
      await this.storeManager.destroy();
      this.storeManager = null;
    }
    this.isInitialized = false;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let unifiedStoreInstance: UnifiedStoreClass | null = null;

export function createUnifiedStore(): UnifiedStoreClass {
  if (unifiedStoreInstance) {
    return unifiedStoreInstance;
  }
  
  unifiedStoreInstance = new UnifiedStoreClass();
  return unifiedStoreInstance;
}

export function getUnifiedStore(): UnifiedStoreClass | null {
  return unifiedStoreInstance;
}

export function destroyUnifiedStore(): void {
  if (unifiedStoreInstance) {
    unifiedStoreInstance.destroy();
    unifiedStoreInstance = null;
  }
}

// ============================================================================
// DERIVED STORES
// ============================================================================

export function createDerivedStores() {
  const store = getUnifiedStore();
  if (!store) {
    // Return empty stores if not initialized
    const emptyState: UnifiedState = {
      communication: { status: 'disconnected', error: null, connectionType: null },
      webrtc: { connectionStatus: 'disconnected', peerConnection: null, dataChannel: null, dataChannelStatus: 'closed', videoStream: null, audioStream: null, latestMessage: null, error: null, stats: null },
      terminal: { connectionStatus: 'disconnected', terminalInstance: null, messages: [], latestMessage: null, error: null, isInitialized: false, rows: 24, cols: 80 },
      rdp: { connectionStatus: 'disconnected', videoElement: null, videoStream: null, audioStream: null, latestMessage: null, error: null, isInitialized: false, isFullscreen: false, isRecording: false, currentOptions: null },
      device: { deviceId: null, name: null, deviceType: null, status: null, connected: false, connectedAt: null, disconnectedAt: null, latestMessage: null, error: null },
      system: { notifications: [], logs: [], error: null }
    };

    return {
      communication: writable(emptyState.communication),
      webrtc: writable(emptyState.webrtc),
      terminal: writable(emptyState.terminal),
      rdp: writable(emptyState.rdp),
      device: writable(emptyState.device),
      system: writable(emptyState.system),
      isConnected: writable(false),
      hasErrors: writable(false)
    };
  }

  const state = store.subscribe;
  
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

export async function initializeUnifiedStore(config: CommunicationConfig): Promise<UnifiedStoreClass> {
  const store = createUnifiedStore();
  await store.initialize(config);
  return store;
}

export function getState(): UnifiedState | null {
  const store = getUnifiedStore();
  return store ? store.getCurrentState() : null;
}

export async function sendMessage(message: UnifiedMessage): Promise<void> {
  const store = getUnifiedStore();
  if (!store) {
    throw new Error('UnifiedStore not initialized');
  }
  return store.sendMessage(message);
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy compatibility for existing code that expects separate stores
 * These will be removed once all code is migrated to the unified store
 */

// WebRTC Store (legacy)
export const webRTCStore = {
  subscribe: (callback: (state: WebRTCState) => void) => {
    const store = getUnifiedStore();
    if (!store) {
      return () => {};
    }
    return store.subscribe((unifiedState) => {
      callback(unifiedState.webrtc);
    });
  }
};

// Terminal Store (legacy)
export const terminalStore = {
  subscribe: (callback: (state: TerminalState) => void) => {
    const store = getUnifiedStore();
    if (!store) {
      return () => {};
    }
    return store.subscribe((unifiedState) => {
      callback(unifiedState.terminal);
    });
  }
};

// RDP Store (legacy)
export const rdpStore = {
  subscribe: (callback: (state: RDPState) => void) => {
    const store = getUnifiedStore();
    if (!store) {
      return () => {};
    }
    return store.subscribe((unifiedState) => {
      callback(unifiedState.rdp);
    });
  }
};

// Device Store (legacy)
export const deviceStore = {
  subscribe: (callback: (state: DeviceState) => void) => {
    const store = getUnifiedStore();
    if (!store) {
      return () => {};
    }
    return store.subscribe((unifiedState) => {
      callback(unifiedState.device);
    });
  }
};

// System Store (legacy)
export const systemStore = {
  subscribe: (callback: (state: SystemState) => void) => {
    const store = getUnifiedStore();
    if (!store) {
      return () => {};
    }
    return store.subscribe((unifiedState) => {
      callback(unifiedState.system);
    });
  }
};

// Communication Store (legacy)
export const communicationStore = {
  subscribe: (callback: (state: any) => void) => {
    const store = getUnifiedStore();
    if (!store) {
      return () => {};
    }
    return store.subscribe((unifiedState) => {
      callback(unifiedState.communication);
    });
  }
};
