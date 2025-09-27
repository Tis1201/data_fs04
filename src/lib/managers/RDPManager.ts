/**
 * RDP Manager
 * 
 * Dedicated RDP (Remote Desktop Protocol) handling that replaces the messy mixed approach.
 * Provides clean separation of concerns for remote desktop functionality.
 */

import { browser } from '$app/environment';
import { writable, type Writable } from 'svelte/store';
import type { 
  RDPMessage, 
  RDPAction, 
  RDPData,
  RDPOptions,
  MouseEventData,
  KeyboardEventData,
  MessageFactory 
} from '../types/unified';
import { getLoggingManager } from './LoggingManager';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RDPConfig {
  quality: 'low' | 'medium' | 'high';
  resolution: { width: number; height: number };
  framerate: number;
  captureMode: 'screen' | 'test';
  enableAudio: boolean;
  enableMouse: boolean;
  enableKeyboard: boolean;
  enableClipboard: boolean;
}

export interface RDPState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'failed';
  videoElement: HTMLVideoElement | null;
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  latestMessage: RDPMessage | null;
  error: string | null;
  isInitialized: boolean;
  isFullscreen: boolean;
  isRecording: boolean;
  currentOptions: RDPOptions | null;
}

export interface RDPEventHandlers {
  onConnectionStateChange?: (state: 'disconnected' | 'connecting' | 'connected' | 'failed') => void;
  onVideoStream?: (stream: MediaStream) => void;
  onAudioStream?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onRecordingChange?: (isRecording: boolean) => void;
  onMessage?: (message: RDPMessage) => void;
}

// ============================================================================
// RDP MANAGER CLASS
// ============================================================================

class RDPManagerClass {
  private config: RDPConfig;
  private state: Writable<RDPState>;
  private videoElement: HTMLVideoElement | null = null;
  private eventHandlers: RDPEventHandlers = {};
  private logger = getLoggingManager();
  private isDestroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(config: Partial<RDPConfig> = {}) {
    this.config = {
      quality: 'medium',
      resolution: { width: 1920, height: 1080 },
      framerate: 30,
      captureMode: 'screen',
      enableAudio: true,
      enableMouse: true,
      enableKeyboard: true,
      enableClipboard: true,
      ...config
    };

    this.state = writable({
      connectionStatus: 'disconnected',
      videoElement: null,
      videoStream: null,
      audioStream: null,
      latestMessage: null,
      error: null,
      isInitialized: false,
      isFullscreen: false,
      isRecording: false,
      currentOptions: null
    });
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Subscribe to state changes
   */
  subscribe = this.state.subscribe;

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: RDPEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Initialize RDP
   */
  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('RDPManager has been destroyed');
    }

    if (!browser) {
      throw new Error('RDP not available in SSR');
    }

    this.logger?.logRDP('initialize', 'unknown', 'Initializing RDP');

    try {
      this.videoElement = videoElement;
      
      // Set up video element event handlers
      this.setupVideoElementHandlers();

      // Set up resize observer
      this.setupResizeObserver(videoElement);

      this.updateState({ 
        videoElement,
        isInitialized: true 
      });

      this.logger?.logRDP('initialize', 'unknown', 'RDP initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.logError('rdp', 'RDP initialization failed', { error: errorMessage });
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
  async connect(deviceId: string, options?: RDPOptions): Promise<void> {
    if (this.isDestroyed) {
      throw new Error('RDPManager has been destroyed');
    }

    if (!this.videoElement) {
      throw new Error('RDP not initialized');
    }

    this.logger?.logRDP('connect', deviceId, 'Connecting to RDP', { options });

    const rdpOptions = {
      quality: this.config.quality,
      resolution: this.config.resolution,
      framerate: this.config.framerate,
      captureMode: this.config.captureMode,
      ...options
    };

    this.updateState({ 
      connectionStatus: 'connecting', 
      error: null,
      currentOptions: rdpOptions
    });

    try {
      // Send start message
      await this.sendMessage(MessageFactory.createRDP('start', deviceId, {
        options: rdpOptions
      }));

      this.logger?.logRDP('connect', deviceId, 'RDP connection initiated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.logError('rdp', 'RDP connection failed', { error: errorMessage, deviceId });
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
    this.logger?.logRDP('disconnect', 'unknown', 'Disconnecting RDP');

    try {
      // Send stop message
      await this.sendMessage(MessageFactory.createRDP('stop', 'unknown', {}));

      // Clear video stream
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }

      this.updateState({
        connectionStatus: 'disconnected',
        videoStream: null,
        audioStream: null,
        error: null,
        isRecording: false
      });

      this.logger?.logRDP('disconnect', 'unknown', 'RDP disconnected successfully');
    } catch (error) {
      this.logger?.logError('rdp', 'RDP disconnect error', { error });
    }
  }

  /**
   * Handle incoming RDP message
   */
  async handleMessage(message: RDPMessage): Promise<void> {
    this.logger?.logRDP('message', message.deviceId, `Handling ${message.action}`, message.data);
    
    this.updateState({ latestMessage: message });

    try {
      switch (message.action) {
        case 'start':
          await this.handleStart(message);
          break;
        case 'stop':
          await this.handleStop(message);
          break;
        case 'mouse':
          await this.handleMouseEvent(message);
          break;
        case 'keyboard':
          await this.handleKeyboardEvent(message);
          break;
        case 'error':
          await this.handleError(message);
          break;
        default:
          this.logger?.logWarn('rdp', `Unknown RDP action: ${message.action}`);
      }

      // Call message handler
      if (this.eventHandlers.onMessage) {
        this.eventHandlers.onMessage(message);
      }
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to handle RDP message', { error, message });
      throw error;
    }
  }

  /**
   * Send mouse event
   */
  async sendMouseEvent(event: MouseEventData): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('RDP not connected');
    }

    this.logger?.logRDP('mouse-event', 'unknown', 'Sending mouse event', { event });

    try {
      await this.sendMessage(MessageFactory.createRDP('mouse', 'unknown', {
        mouse: event
      }));
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to send mouse event', { error, event });
      throw error;
    }
  }

  /**
   * Send keyboard event
   */
  async sendKeyboardEvent(event: KeyboardEventData): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('RDP not connected');
    }

    this.logger?.logRDP('keyboard-event', 'unknown', 'Sending keyboard event', { event });

    try {
      await this.sendMessage(MessageFactory.createRDP('keyboard', 'unknown', {
        keyboard: event
      }));
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to send keyboard event', { error, event });
      throw error;
    }
  }

  /**
   * Toggle fullscreen
   */
  async toggleFullscreen(): Promise<void> {
    if (!this.videoElement) {
      throw new Error('RDP not initialized');
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        this.updateState({ isFullscreen: false });
        if (this.eventHandlers.onFullscreenChange) {
          this.eventHandlers.onFullscreenChange(false);
        }
      } else {
        await this.videoElement.requestFullscreen();
        this.updateState({ isFullscreen: true });
        if (this.eventHandlers.onFullscreenChange) {
          this.eventHandlers.onFullscreenChange(true);
        }
      }
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to toggle fullscreen', { error });
      throw error;
    }
  }

  /**
   * Start recording
   */
  async startRecording(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('RDP not connected');
    }

    this.logger?.logRDP('start-recording', 'unknown', 'Starting recording');

    try {
      // This would typically start screen recording
      this.updateState({ isRecording: true });
      
      if (this.eventHandlers.onRecordingChange) {
        this.eventHandlers.onRecordingChange(true);
      }
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to start recording', { error });
      throw error;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    this.logger?.logRDP('stop-recording', 'unknown', 'Stopping recording');

    try {
      // This would typically stop screen recording
      this.updateState({ isRecording: false });
      
      if (this.eventHandlers.onRecordingChange) {
        this.eventHandlers.onRecordingChange(false);
      }
    } catch (error) {
      this.logger?.logError('rdp', 'Failed to stop recording', { error });
      throw error;
    }
  }

  /**
   * Send a RDP message
   */
  async sendMessage(message: RDPMessage): Promise<void> {
    this.logger?.logRDP('send', message.deviceId, `Sending ${message.action}`, message.data);
    
    // This would typically send through the CommunicationManager
    // For now, we'll just log it
    console.log('[RDPManager] Sending message:', message);
  }

  /**
   * Get current state
   */
  getCurrentState(): RDPState {
    let state: RDPState;
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

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    await this.disconnect();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private updateState(updates: Partial<RDPState>): void {
    this.state.update(current => ({ ...current, ...updates }));
  }

  private setupVideoElementHandlers(): void {
    if (!this.videoElement) return;

    this.videoElement.addEventListener('loadedmetadata', () => {
      this.logger?.logRDP('video-loaded', 'unknown', 'Video metadata loaded');
    });

    this.videoElement.addEventListener('canplay', () => {
      this.logger?.logRDP('video-canplay', 'unknown', 'Video can play');
    });

    this.videoElement.addEventListener('error', (event) => {
      this.logger?.logError('rdp', 'Video element error', { error: event });
    });

    // Fullscreen change handler
    document.addEventListener('fullscreenchange', () => {
      const isFullscreen = !!document.fullscreenElement;
      this.updateState({ isFullscreen });
      if (this.eventHandlers.onFullscreenChange) {
        this.eventHandlers.onFullscreenChange(isFullscreen);
      }
    });
  }

  private setupResizeObserver(videoElement: HTMLVideoElement): void {
    if (!browser || !window.ResizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.logger?.logRDP('resize', 'unknown', 'Video element resized', { width, height });
      }
    });

    this.resizeObserver.observe(videoElement);
  }

  private async handleStart(message: RDPMessage): Promise<void> {
    this.logger?.logRDP('handle-start', message.deviceId, 'Handling RDP start');

    this.updateState({ 
      connectionStatus: 'connected',
      error: null 
    });

    if (this.eventHandlers.onConnectionStateChange) {
      this.eventHandlers.onConnectionStateChange('connected');
    }
  }

  private async handleStop(message: RDPMessage): Promise<void> {
    this.logger?.logRDP('handle-stop', message.deviceId, 'Handling RDP stop');

    this.updateState({ 
      connectionStatus: 'disconnected',
      videoStream: null,
      audioStream: null,
      isRecording: false
    });

    if (this.eventHandlers.onConnectionStateChange) {
      this.eventHandlers.onConnectionStateChange('disconnected');
    }
  }

  private async handleMouseEvent(message: RDPMessage): Promise<void> {
    this.logger?.logRDP('handle-mouse', message.deviceId, 'Handling mouse event', { event: message.data.mouse });

    // This would typically handle mouse events from the remote desktop
    // For now, we'll just log it
  }

  private async handleKeyboardEvent(message: RDPMessage): Promise<void> {
    this.logger?.logRDP('handle-keyboard', message.deviceId, 'Handling keyboard event', { event: message.data.keyboard });

    // This would typically handle keyboard events from the remote desktop
    // For now, we'll just log it
  }

  private async handleError(message: RDPMessage): Promise<void> {
    this.logger?.logError('rdp', 'RDP error received', { 
      error: message.data.error,
      deviceId: message.deviceId 
    });

    this.updateState({ 
      connectionStatus: 'failed',
      error: message.data.error || 'Unknown RDP error'
    });

    if (this.eventHandlers.onError) {
      this.eventHandlers.onError(new Error(message.data.error || 'Unknown RDP error'));
    }

    if (this.eventHandlers.onConnectionStateChange) {
      this.eventHandlers.onConnectionStateChange('failed');
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let rdpManagerInstance: RDPManagerClass | null = null;

export function createRDPManager(config?: Partial<RDPConfig>): RDPManagerClass {
  if (rdpManagerInstance) {
    return rdpManagerInstance;
  }
  
  rdpManagerInstance = new RDPManagerClass(config);
  return rdpManagerInstance;
}

export function getRDPManager(): RDPManagerClass | null {
  return rdpManagerInstance;
}

export function destroyRDPManager(): void {
  if (rdpManagerInstance) {
    rdpManagerInstance.destroy();
    rdpManagerInstance = null;
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function initializeRDP(videoElement: HTMLVideoElement, config?: Partial<RDPConfig>): Promise<RDPManagerClass> {
  const manager = createRDPManager(config);
  await manager.initialize(videoElement);
  return manager;
}

export function getRDPState(): RDPState | null {
  const manager = getRDPManager();
  return manager ? manager.getCurrentState() : null;
}

export function isRDPConnected(): boolean {
  const manager = getRDPManager();
  return manager ? manager.isConnected() : false;
}

export function isRDPInitialized(): boolean {
  const manager = getRDPManager();
  return manager ? manager.isInitialized() : false;
}
