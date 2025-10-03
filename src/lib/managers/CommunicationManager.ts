/**
 * Communication Manager
 * 
 * Unified interface for handling both SSE (local dev) and Pushpin (production)
 * communication. This replaces the messy mixed WebSocket/SSE approach.
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { 
  UnifiedMessage, 
  MessageType, 
  MessageValidator, 
  MessageRouter 
} from '../types/unified';

// ============================================================================
// INTERFACES
// ============================================================================

export interface CommunicationConfig {
  mode: 'development' | 'production';
  sseEndpoint?: string;
  pushpinEndpoint?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  error: string | null;
  lastConnected: number | null;
  reconnectAttempts: number;
  connectionType: 'sse' | 'pushpin' | null;
}

export interface MessageHandler {
  (message: UnifiedMessage): void | Promise<void>;
}

// ============================================================================
// COMMUNICATION MANAGER CLASS
// ============================================================================

class CommunicationManagerClass {
  private config: CommunicationConfig;
  private connection: any = null;
  private messageHandlers: Map<MessageType, MessageHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isDestroyed = false;

  // Reactive state
  private state = writable<ConnectionState>({
    status: 'disconnected',
    error: null,
    lastConnected: null,
    reconnectAttempts: 0,
    connectionType: null
  });

  constructor(config: CommunicationConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      ...config
    };
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Subscribe to state changes
   */
  subscribe = this.state.subscribe;

  /**
   * Connect to the communication channel
   */
  async connect(): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('CommunicationManager has been destroyed');
    }

    this.updateState({ status: 'connecting' });

    try {
      if (this.config.mode === 'development') {
        await this.connectSSE();
      } else {
        await this.connectPushpin();
      }
      
      this.updateState({ 
        status: 'connected',
        error: null,
        lastConnected: Date.now(),
        reconnectAttempts: 0
      });

      this.startPing();
      console.log(`[CommunicationManager] Connected via ${this.config.mode === 'development' ? 'SSE' : 'Pushpin'}`);
    } catch (error) {
      console.error('[CommunicationManager] Connection failed:', error);
      this.updateState({ 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the communication channel
   */
  async disconnect(): Promise<void> {
    this.isDestroyed = true;
    this.clearTimers();
    
    if (this.connection) {
      try {
        if (this.config.mode === 'development' && this.connection.close) {
          this.connection.close();
        } else if (this.config.mode === 'production' && this.connection.disconnect) {
          await this.connection.disconnect();
        }
      } catch (error) {
        console.warn('[CommunicationManager] Error during disconnect:', error);
      }
    }

    this.connection = null;
    this.updateState({ 
      status: 'disconnected',
      error: null,
      connectionType: null
    });
  }

  /**
   * Send a message
   */
  async send(message: UnifiedMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to communication channel');
    }

    if (!MessageValidator.validate(message)) {
      throw new Error('Invalid message format');
    }

    try {
      if (this.config.mode === 'development') {
        await this.sendSSE(message);
      } else {
        await this.sendPushpin(message);
      }
    } catch (error) {
      console.error('[CommunicationManager] Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Register a message handler
   */
  on(type: MessageType, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection !== null && this.getCurrentState().status === 'connected';
  }

  /**
   * Get current state
   */
  getCurrentState(): ConnectionState {
    let state: ConnectionState;
    this.state.subscribe(s => state = s)();
    return state!;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updateState(updates: Partial<ConnectionState>): void {
    this.state.update(current => ({ ...current, ...updates }));
  }

  private async connectSSE(): Promise<void> {
    if (!browser) {
      throw new Error('SSE connection not available in SSR');
    }

    const endpoint = this.config.sseEndpoint || '/api/sse';
    const eventSource = new EventSource(endpoint);
    
    eventSource.onopen = () => {
      this.connection = eventSource;
      this.updateState({ connectionType: 'sse' });
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('[CommunicationManager] Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[CommunicationManager] SSE error:', error);
      this.handleConnectionError();
    };

    // Wait for connection to be established
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, 10000);

      eventSource.onopen = () => {
        clearTimeout(timeout);
        this.connection = eventSource;
        this.updateState({ connectionType: 'sse' });
        resolve();
      };

      eventSource.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('SSE connection failed'));
      };
    });
  }

  private async connectPushpin(): Promise<void> {
    // In production, this would connect to Pushpin
    // For now, we'll simulate the connection
    return new Promise((resolve) => {
      setTimeout(() => {
        this.connection = {
          send: (message: any) => {
            console.log('[CommunicationManager] Pushpin send:', message);
          },
          disconnect: () => {
            console.log('[CommunicationManager] Pushpin disconnect');
          }
        };
        this.updateState({ connectionType: 'pushpin' });
        resolve();
      }, 100);
    });
  }

  private async sendSSE(message: UnifiedMessage): Promise<void> {
    // SSE is unidirectional, so we need to use a different method for sending
    // This would typically be done via a separate API endpoint
    const response = await fetch('/api/sse/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Failed to send SSE message: ${response.statusText}`);
    }
  }

  private async sendPushpin(message: UnifiedMessage): Promise<void> {
    if (this.connection && this.connection.send) {
      this.connection.send(message);
    } else {
      throw new Error('Pushpin connection not available');
    }
  }

  private handleMessage(data: any): void {
    if (!MessageValidator.validate(data)) {
      console.warn('[CommunicationManager] Received invalid message:', data);
      return;
    }

    const message = data as UnifiedMessage;
    const handlers = this.messageHandlers.get(message.type);
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('[CommunicationManager] Handler error:', error);
        }
      });
    }
  }

  private handleConnectionError(): void {
    this.updateState({ 
      status: 'error',
      error: 'Connection lost'
    });
    
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;

    const currentState = this.getCurrentState();
    if (currentState.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      this.updateState({ 
        status: 'error',
        error: 'Max reconnection attempts reached'
      });
      return;
    }

    this.updateState({ 
      status: 'reconnecting',
      reconnectAttempts: currentState.reconnectAttempts + 1
    });

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('[CommunicationManager] Reconnection failed:', error);
      });
    }, this.config.reconnectInterval);
  }

  private startPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }

    this.pingTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          id: `ping_${Date.now()}`,
          type: 'system',
          action: 'status',
          deviceId: 'ping',
          data: { message: 'ping' },
          timestamp: Date.now()
        }).catch(error => {
          console.warn('[CommunicationManager] Ping failed:', error);
        });
      }
    }, this.config.pingInterval);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let communicationManagerInstance: CommunicationManagerClass | null = null;

export function createCommunicationManager(config: CommunicationConfig): CommunicationManagerClass {
  if (communicationManagerInstance) {
    return communicationManagerInstance;
  }
  
  communicationManagerInstance = new CommunicationManagerClass(config);
  return communicationManagerInstance;
}

export function getCommunicationManager(): CommunicationManagerClass | null {
  return communicationManagerInstance;
}

export function destroyCommunicationManager(): void {
  if (communicationManagerInstance) {
    communicationManagerInstance.disconnect();
    communicationManagerInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function sendMessage(message: UnifiedMessage): Promise<void> {
  const manager = getCommunicationManager();
  if (!manager) {
    throw new Error('CommunicationManager not initialized');
  }
  return manager.send(message);
}

export function onMessage(type: MessageType, handler: MessageHandler): () => void {
  const manager = getCommunicationManager();
  if (!manager) {
    throw new Error('CommunicationManager not initialized');
  }
  return manager.on(type, handler);
}

export function isConnected(): boolean {
  const manager = getCommunicationManager();
  return manager ? manager.isConnected() : false;
}
