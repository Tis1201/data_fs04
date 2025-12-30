/**
 * MQTT RDP Flow
 * 
 * Client-side MQTT client wrapper for RDP (Remote Desktop Protocol) functionality.
 * Handles RDP start/stop requests and status updates via MQTT.
 */

import { mqttClient } from './mqttClient';

// ============================================================================
// TYPES
// ============================================================================

interface RDPOptions {
    frameRate?: number;
    quality?: number;
    captureMode?: string;
}

// ============================================================================
// RDP MQTT CLIENT CLASS
// ============================================================================

export class RDPMqttClient {
    private deviceId: string;
    private onStatusCallback: ((status: string, data?: any) => void) | null = null;
    private onErrorCallback: ((error: string) => void) | null = null;
    private unsubscribe: (() => void) | null = null;

    constructor(deviceId: string) {
        this.deviceId = deviceId;
        console.debug('[RDPMqtt] Created RDP MQTT client', { deviceId });
    }

    /**
     * Start RDP session
     */
    async start(options?: RDPOptions): Promise<void> {
        console.log('[RDPMqtt] Starting RDP session', { deviceId: this.deviceId, options });

        // Subscribe to RDP notifications before sending start request
        this.unsubscribe = mqttClient.onNotification('device:rdp', (payload: any) => {
            this.handleRDPMessage(payload);
        });

        // Send RDP start request
        try {
            await mqttClient.request('rdp.start', {
                deviceId: this.deviceId,
                options: options || {
                    frameRate: 60,
                    quality: 80,
                    captureMode: 'screen'
                }
            });
            console.log('[RDPMqtt] RDP start request sent');
        } catch (error) {
            console.error('[RDPMqtt] Failed to send RDP start request', error);
            throw error;
        }
    }

    /**
     * Stop RDP session
     */
    async stop(): Promise<void> {
        console.log('[RDPMqtt] Stopping RDP session', { deviceId: this.deviceId });

        try {
            // Unsubscribe from notifications
            if (this.unsubscribe) {
                this.unsubscribe();
                this.unsubscribe = null;
            }

            // Send RDP stop request
            await mqttClient.request('rdp.stop', {
                deviceId: this.deviceId
            });
            console.log('[RDPMqtt] RDP stop request sent');
        } catch (error) {
            console.error('[RDPMqtt] Failed to send RDP stop request', error);
            throw error;
        }
    }

    /**
     * Send RDP control message
     */
    async sendControl(controlType: string, data?: any): Promise<void> {
        console.debug('[RDPMqtt] Sending RDP control', { deviceId: this.deviceId, controlType });

        try {
            await mqttClient.request('rdp.control', {
                deviceId: this.deviceId,
                controlType,
                data
            });
        } catch (error) {
            console.error('[RDPMqtt] Failed to send RDP control', error);
            throw error;
        }
    }

    /**
     * Register status callback
     */
    onStatus(callback: (status: string, data?: any) => void): void {
        this.onStatusCallback = callback;
    }

    /**
     * Register error callback
     */
    onError(callback: (error: string) => void): void {
        this.onErrorCallback = callback;
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        console.log('[RDPMqtt] Cleaning up RDP MQTT client');
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.onStatusCallback = null;
        this.onErrorCallback = null;
    }

    /**
     * Handle RDP message from device
     */
    private handleRDPMessage(payload: any): void {
        console.debug('[RDPMqtt] Received RDP message', payload);

        // Extract message type from payload
        let messageType = payload?.payload?.type || payload?.type;
        const data = payload?.payload || payload;

        // Infer message type if missing (for backward compatibility or simplified messages)
        if (!messageType) {
            if (data?.status === 'started') {
                messageType = 'rdp:started';
            } else if (data?.status === 'stopped') {
                messageType = 'rdp:stopped';
            } else if (data?.error) {
                messageType = 'rdp:error';
            }
        }

        console.debug('[RDPMqtt] Processing RDP message', { messageType, data });

        switch (messageType) {
            case 'rdp:started':
                console.log('[RDPMqtt] RDP session started');
                if (this.onStatusCallback) {
                    this.onStatusCallback('started', data);
                }
                break;

            case 'rdp:stopped':
                console.log('[RDPMqtt] RDP session stopped');
                if (this.onStatusCallback) {
                    this.onStatusCallback('stopped', data);
                }
                break;

            case 'rdp:status':
                console.debug('[RDPMqtt] RDP status update', data);
                if (this.onStatusCallback) {
                    this.onStatusCallback('status', data);
                }
                break;

            case 'rdp:error':
                console.error('[RDPMqtt] RDP error', data);
                if (this.onErrorCallback && data.error) {
                    this.onErrorCallback(data.error);
                }
                break;

            default:
                console.warn('[RDPMqtt] Unknown RDP message type', { messageType, data });
        }
    }
}

/**
 * Create a new RDP MQTT client instance
 */
export function createRDPMqttClient(deviceId: string): RDPMqttClient {
    return new RDPMqttClient(deviceId);
}

