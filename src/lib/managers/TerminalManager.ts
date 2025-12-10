/**
 * Terminal Manager
 * 
 * Dedicated terminal handling that replaces the messy mixed approach.
 * Provides clean separation of concerns for terminal functionality.
 */

import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';
import type { 
  TerminalMessage, 
  TerminalAction, 
  TerminalData
} from '../types/unified';
import { MessageFactory } from '../types/unified';
import { getLoggingManager } from './LoggingManager';

// ============================================================================
// INTERFACES
// ============================================================================

export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark';
  cursorBlink: boolean;
  scrollback: number;
  tabStopWidth: number;
}

export interface TerminalState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  terminalInstance: any | null;
  messages: TerminalMessage[];
  latestMessage: TerminalMessage | null;
  error: string | null;
  isInitialized: boolean;
  rows: number;
  cols: number;
}

export interface TerminalEventHandlers {
  onConnectionStateChange?: (state: 'disconnected' | 'connecting' | 'connected' | 'failed') => void;
  onOutput?: (output: string) => void;
  onError?: (error: Error) => void;
  onResize?: (rows: number, cols: number) => void;
  onMessage?: (message: TerminalMessage) => void;
}

// ============================================================================
// TERMINAL MANAGER CLASS
// ============================================================================

class TerminalManagerClass {
  private config: TerminalConfig;
  private state: Writable<TerminalState>;
  private terminalInstance: any = null;
  private eventHandlers: TerminalEventHandlers = {};
  private logger = getLoggingManager();
  private isDestroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(config: Partial<TerminalConfig> = {}) {
    this.config = {
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      theme: 'dark',
      cursorBlink: true,
      scrollback: 1000,
      tabStopWidth: 4,
      ...config
    };

    this.state = writable({
      connectionStatus: 'disconnected',
      terminalInstance: null,
      messages: [],
      latestMessage: null,
      error: null,
      isInitialized: false,
      rows: 24,
      cols: 80
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Subscribe to state changes
   */
  get subscribe() {
    return this.state.subscribe;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: TerminalEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Initialize terminal
   */
  async initialize(container: HTMLElement): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('TerminalManager has been destroyed');
    }

    if (!browser) {
      throw new Error('Terminal not available in SSR');
    }

    this.logger?.logTerminal('initialize', 'unknown', 'Initializing terminal');

    try {
      // This would typically initialize a terminal library like xterm.js
      // For now, we'll create a mock terminal instance
      this.terminalInstance = {
        container,
        config: this.config,
        write: (data: string) => {
          // Just write locally, not through handleOutput which expects a message
          console.log('[Terminal] Write:', data);
        },
        onData: (callback: (data: string) => void) => {
          this.terminalInstance.dataCallback = callback;
        },
        onResize: (callback: (size: { rows: number; cols: number }) => void) => {
          this.terminalInstance.resizeCallback = callback;
        },
        resize: (cols: number, rows: number) => {
          this.terminalInstance.cols = cols;
          this.terminalInstance.rows = rows;
          this.updateState({ rows, cols });
        },
        focus: () => {
          // Focus terminal
        },
        blur: () => {
          // Blur terminal
        },
        clear: () => {
          // Clear terminal
        },
        dispose: () => {
          // Dispose terminal
        }
      };

      // Set up resize observer
      this.setupResizeObserver(container);

      this.updateState({ 
        terminalInstance: this.terminalInstance,
        isInitialized: true 
      });

      this.logger?.logTerminal('initialize', 'unknown', 'Terminal initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error('terminal', 'Terminal initialization failed', { error: errorMessage });
      this.updateState({ 
        isInitialized: false,
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Connect to a device
   */
  async connect(deviceId: string): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('TerminalManager has been destroyed');
    }

    if (!this.terminalInstance) {
      throw new Error('Terminal not initialized');
    }

    this.logger?.logTerminal('connect', deviceId, 'Connecting to terminal');
    this.updateState({ connectionStatus: 'connecting', error: null });

    try {
      // Send connect message
      await this.sendMessage(MessageFactory.createTerminal('connect', deviceId, {
        connectionState: 'connecting'
      }));

      this.logger?.logTerminal('connect', deviceId, 'Terminal connection initiated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.error('terminal', 'Terminal connection failed', { error: errorMessage, deviceId });
      this.updateState({ 
        connectionStatus: 'failed', 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    this.logger?.logTerminal('disconnect', 'unknown', 'Disconnecting terminal');

    try {
      // Send disconnect message
      await this.sendMessage(MessageFactory.createTerminal('disconnect', 'unknown', {
        connectionState: 'disconnected'
      }));

      this.updateState({
        connectionStatus: 'disconnected',
        error: null
      });

      this.logger?.logTerminal('disconnect', 'unknown', 'Terminal disconnected successfully');
    } catch (error) {
      this.logger?.error('terminal', 'Terminal disconnect error', { error });
    }
  }

  /**
   * Handle incoming terminal message
   */
  async handleMessage(message: TerminalMessage): Promise<void> {
    this.logger?.logTerminal('message', message.deviceId, `Handling ${message.action}`, message.data);
    
    this.updateState({ latestMessage: message });

    try {
      switch (message.action) {
        case 'connect':
          await this.handleConnect(message);
          break;
        case 'disconnect':
          await this.handleDisconnect(message);
          break;
        case 'input':
          await this.handleInput(message);
          break;
        case 'output':
          await this.handleOutput(message);
          break;
        case 'resize':
          await this.handleResize(message);
          break;
        case 'error':
          await this.handleError(message);
          break;
        default:
          this.logger?.warn('terminal', `Unknown terminal action: ${message.action}`);
      }

      // Call message handler
      if (this.eventHandlers.onMessage) {
        this.eventHandlers.onMessage(message);
      }
    } catch (error) {
      this.logger?.error('terminal', 'Failed to handle terminal message', { error, message });
      throw error;
    }
  }

  /**
   * Send terminal input
   */
  async sendInput(input: string): Promise<void> {
    if (!this.terminalInstance) {
      throw new Error('Terminal not initialized');
    }

    this.logger?.logTerminal('input', 'unknown', 'Sending terminal input', { input });

    try {
      // Send input message
      await this.sendMessage(MessageFactory.createTerminal('input', 'unknown', {
        input
      }));

      // Also write to local terminal
      if (this.terminalInstance.write) {
        this.terminalInstance.write(input);
      }
    } catch (error) {
      this.logger?.error('terminal', 'Failed to send terminal input', { error, input });
      throw error;
    }
  }

  /**
   * Resize terminal
   */
  async resize(rows: number, cols: number): Promise<void> {
    if (!this.terminalInstance) {
      throw new Error('Terminal not initialized');
    }

    this.logger?.logTerminal('resize', 'unknown', 'Resizing terminal', { rows, cols });

    try {
      // Update local terminal size
      if (this.terminalInstance.resize) {
        this.terminalInstance.resize(cols, rows);
      }

      // Send resize message
      await this.sendMessage(MessageFactory.createTerminal('resize', 'unknown', {
        rows,
        cols
      }));

      this.updateState({ rows, cols });

      if (this.eventHandlers.onResize) {
        this.eventHandlers.onResize(rows, cols);
      }
    } catch (error) {
      this.logger?.error('terminal', 'Failed to resize terminal', { error, rows, cols });
      throw error;
    }
  }

  /**
   * Clear terminal
   */
  clear(): void {
    if (!this.terminalInstance) {
      throw new Error('Terminal not initialized');
    }

    this.logger?.logTerminal('clear', 'unknown', 'Clearing terminal');

    if (this.terminalInstance.clear) {
      this.terminalInstance.clear();
    }
  }

  /**
   * Focus terminal
   */
  focus(): void {
    if (!this.terminalInstance) {
      throw new Error('Terminal not initialized');
    }

    if (this.terminalInstance.focus) {
      this.terminalInstance.focus();
    }
  }

  /**
   * Blur terminal
   */
  blur(): void {
    if (!this.terminalInstance) {
      throw new Error('Terminal not initialized');
    }

    if (this.terminalInstance.blur) {
      this.terminalInstance.blur();
    }
  }

  /**
   * Send a terminal message
   */
  async sendMessage(message: TerminalMessage): Promise<void> {
    this.logger?.logTerminal('send', message.deviceId, `Sending ${message.action}`, message.data);
    
    // This would typically send through the CommunicationManager
    // For now, we'll just log it
    console.log('[TerminalManager] Sending message:', message);
  }

  /**
   * Get current state
   */
  getCurrentState(): TerminalState {
    let state: TerminalState;
    this.state.subscribe(s => state = s)();
    return state!;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.getCurrentState().connectionStatus === 'connected';
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.getCurrentState().isInitialized;
  }

  /**
   * Destroy the manager
   */
  async destroy(): Promise<void> {
    this.isDestroyed = true;
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.terminalInstance) {
      if (this.terminalInstance.dispose) {
        this.terminalInstance.dispose();
      }
      this.terminalInstance = null;
    }

    await this.disconnect();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updateState(updates: Partial<TerminalState>): void {
    this.state.update(current => ({ ...current, ...updates }));
  }

  private setupResizeObserver(container: HTMLElement): void {
    if (!browser || !window.ResizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const cols = Math.floor(width / (this.config.fontSize * 0.6));
        const rows = Math.floor(height / (this.config.fontSize * 1.2));
        
        if (cols > 0 && rows > 0) {
          this.resize(cols, rows);
        }
      }
    });

    this.resizeObserver.observe(container);
  }

  private async handleConnect(message: TerminalMessage): Promise<void> {
    this.logger?.logTerminal('handle-connect', message.deviceId, 'Handling terminal connect');

    this.updateState({ 
      connectionStatus: 'connected',
      error: null 
    });

    if (this.eventHandlers.onConnectionStateChange) {
      this.eventHandlers.onConnectionStateChange('connected');
    }
  }

  private async handleDisconnect(message: TerminalMessage): Promise<void> {
    this.logger?.logTerminal('handle-disconnect', message.deviceId, 'Handling terminal disconnect');

    this.updateState({ 
      connectionStatus: 'disconnected' 
    });

    if (this.eventHandlers.onConnectionStateChange) {
      this.eventHandlers.onConnectionStateChange('disconnected');
    }
  }

  private async handleInput(message: TerminalMessage): Promise<void> {
    this.logger?.logTerminal('handle-input', message.deviceId, 'Handling terminal input', { input: message.data.input });

    // Add to messages
    const currentState = this.getCurrentState();
    this.updateState({
      messages: [...currentState.messages, message]
    });
  }

  private async handleOutput(message: TerminalMessage): Promise<void> {
    this.logger?.logTerminal('handle-output', message.deviceId, 'Handling terminal output', { output: message.data.output });

    // Write to terminal
    if (this.terminalInstance && this.terminalInstance.write && message.data.output) {
      this.terminalInstance.write(message.data.output);
    }

    // Add to messages
    const currentState = this.getCurrentState();
    this.updateState({
      messages: [...currentState.messages, message]
    });

    // Call output handler
    if (this.eventHandlers.onOutput && message.data.output) {
      this.eventHandlers.onOutput(message.data.output);
    }
  }

  private async handleResize(message: TerminalMessage): Promise<void> {
    this.logger?.logTerminal('handle-resize', message.deviceId, 'Handling terminal resize', { 
      rows: message.data.rows, 
      cols: message.data.cols 
    });

    if (message.data.rows && message.data.cols) {
      this.updateState({
        rows: message.data.rows,
        cols: message.data.cols
      });

      if (this.terminalInstance && this.terminalInstance.resize) {
        this.terminalInstance.resize(message.data.cols, message.data.rows);
      }

      if (this.eventHandlers.onResize) {
        this.eventHandlers.onResize(message.data.rows, message.data.cols);
      }
    }
  }

  private async handleError(message: TerminalMessage): Promise<void> {
    this.logger?.error('terminal', 'Terminal error received', { 
      error: message.data.error,
      deviceId: message.deviceId 
    });

    this.updateState({ 
      connectionStatus: 'failed',
      error: message.data.error || 'Unknown terminal error'
    });

    if (this.eventHandlers.onError) {
      this.eventHandlers.onError(new Error(message.data.error || 'Unknown terminal error'));
    }

    if (this.eventHandlers.onConnectionStateChange) {
      this.eventHandlers.onConnectionStateChange('failed');
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let terminalManagerInstance: TerminalManagerClass | null = null;

export function createTerminalManager(config?: Partial<TerminalConfig>): TerminalManagerClass {
  if (terminalManagerInstance) {
    return terminalManagerInstance;
  }
  
  terminalManagerInstance = new TerminalManagerClass(config);
  return terminalManagerInstance;
}

export function getTerminalManager(): TerminalManagerClass | null {
  return terminalManagerInstance;
}

export function destroyTerminalManager(): void {
  if (terminalManagerInstance) {
    terminalManagerInstance.destroy();
    terminalManagerInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function initializeTerminal(container: HTMLElement, config?: Partial<TerminalConfig>): Promise<TerminalManagerClass> {
  const manager = createTerminalManager(config);
  await manager.initialize(container);
  return manager;
}

export function getTerminalState(): TerminalState | null {
  const manager = getTerminalManager();
  return manager ? manager.getCurrentState() : null;
}

export function isTerminalConnected(): boolean {
  const manager = getTerminalManager();
  return manager ? manager.isConnected() : false;
}

export function isTerminalInitialized(): boolean {
  const manager = getTerminalManager();
  return manager ? manager.isInitialized() : false;
}
