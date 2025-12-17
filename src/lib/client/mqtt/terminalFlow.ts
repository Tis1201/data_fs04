import { mqttClient } from './mqttClient';

export interface TerminalMessage {
  output?: string;
  error?: string;
  type: 'terminal:output' | 'terminal:error' | 'terminal:connected' | 'terminal:disconnected';
}

export class TerminalMqttClient {
  private deviceId: string;
  private onOutputCallback: ((output: string) => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;
  private onDisconnectedCallback: (() => void) | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  async connect(rows: number, cols: number): Promise<void> {
    console.log('[TerminalMqtt] Connecting to device terminal', { deviceId: this.deviceId, rows, cols });

    // Set up listener for terminal messages
    this.unsubscribe = mqttClient.onNotification('device:terminal', (payload: any) => {
      this.handleTerminalMessage(payload);
    });

    // Send connect request via RPC
    await mqttClient.request('terminal.connect', {
      deviceId: this.deviceId,
      rows,
      cols
    });

    console.log('[TerminalMqtt] Connect request sent');
  }

  async sendInput(input: string): Promise<void> {
    await mqttClient.request('terminal.input', {
      deviceId: this.deviceId,
      input
    });
  }

  async resize(rows: number, cols: number): Promise<void> {
    console.log('[TerminalMqtt] Resizing terminal', { rows, cols });
    await mqttClient.request('terminal.resize', {
      deviceId: this.deviceId,
      rows,
      cols
    });
  }

  async disconnect(): Promise<void> {
    console.log('[TerminalMqtt] Disconnecting from terminal');
    
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    await mqttClient.request('terminal.disconnect', {
      deviceId: this.deviceId
    });
  }

  onOutput(callback: (output: string) => void): void {
    this.onOutputCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  private handleTerminalMessage(payload: any): void {
    // Extract nested payload (device sends: { payload: { type: 'terminal:output', ... } })
    const data = payload?.payload || payload;
    const type = data?.type;

    console.log('[TerminalMqtt] Received terminal message', { type, hasOutput: !!data?.output });

    switch (type) {
      case 'terminal:output':
        if (this.onOutputCallback && data.output) {
          this.onOutputCallback(data.output);
        }
        break;
      case 'terminal:error':
        if (this.onErrorCallback) {
          const error = data.error || data.message || 'Unknown terminal error';
          this.onErrorCallback(error);
        }
        break;
      case 'terminal:connected':
        console.log('[TerminalMqtt] Terminal connected');
        if (this.onConnectedCallback) {
          this.onConnectedCallback();
        }
        break;
      case 'terminal:disconnected':
        console.log('[TerminalMqtt] Terminal disconnected');
        if (this.onDisconnectedCallback) {
          this.onDisconnectedCallback();
        }
        break;
      default:
        console.warn('[TerminalMqtt] Unknown terminal message type:', type);
    }
  }
}
