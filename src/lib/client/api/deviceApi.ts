import { logger } from '$lib/server/logger';

export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
        timestamp: string;
        requestId: string;
    };
}

export interface DeviceActionRequest {
    deviceId: string;
    action: string;
    payload?: any;
}

export interface FileOperationRequest {
    deviceId: string;
    sourcePath: string;
    destinationPath: string;
    resourceId?: string;
    metadata?: any;
}

export interface AppInstallRequest {
    deviceId: string;
    packageName: string;
    appName?: string;
    version?: string;
    sourcePath?: string;
}

export class DeviceAPI {
    private baseUrl: string;

    constructor(baseUrl: string = '') {
        this.baseUrl = baseUrl;
    }

    private async makeRequest<T>(
        endpoint: string, 
        options: RequestInit = {}
    ): Promise<APIResponse<T>> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await response.json();

            if (!response.ok) {
                logger.error(`[DeviceAPI] Request failed: ${response.status} - ${data.error?.message || 'Unknown error'}`);
                return {
                    success: false,
                    error: data.error || {
                        code: 'REQUEST_FAILED',
                        message: `HTTP ${response.status}`,
                        timestamp: new Date().toISOString(),
                        requestId: crypto.randomUUID()
                    }
                };
            }

            return data;
        } catch (error) {
            logger.error(`[DeviceAPI] Request error: ${String(error)}`);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: String(error),
                    timestamp: new Date().toISOString(),
                    requestId: crypto.randomUUID()
                }
            };
        }
    }

    // Unified Device Actions
    async executeAction(deviceId: string, action: string, payload: any = {}): Promise<APIResponse> {
        return this.makeRequest(`/api/devices/${deviceId}/actions`, {
            method: 'POST',
            body: JSON.stringify({
                action,
                ...payload
            })
        });
    }

    // Convenience methods for common actions
    async rebootDevice(deviceId: string): Promise<APIResponse> {
        return this.executeAction(deviceId, 'reboot');
    }

    async restartDevice(deviceId: string): Promise<APIResponse> {
        return this.executeAction(deviceId, 'restart');
    }

    async installApp(request: AppInstallRequest): Promise<APIResponse> {
        return this.executeAction(request.deviceId, 'installApp', {
            packageName: request.packageName,
            appName: request.appName,
            version: request.version,
            sourcePath: request.sourcePath
        });
    }

    async pushFile(request: FileOperationRequest): Promise<APIResponse> {
        return this.executeAction(request.deviceId, 'pushFile', {
            sourcePath: request.sourcePath,
            destinationPath: request.destinationPath,
            metadata: request.metadata
        });
    }

    async pullFile(request: FileOperationRequest): Promise<APIResponse> {
        return this.executeAction(request.deviceId, 'pullFile', {
            sourcePath: request.sourcePath,
            destinationPath: request.destinationPath,
            resourceId: request.resourceId,
            metadata: request.metadata
        });
    }

    async updateFirmware(deviceId: string, firmwareVersion: string, metadata?: any): Promise<APIResponse> {
        return this.executeAction(deviceId, 'updateFirmware', {
            firmwareVersion,
            metadata
        });
    }

    // Status and Monitoring
    async getDeviceStatus(deviceId: string): Promise<APIResponse> {
        return this.makeRequest(`/api/devices/${deviceId}/status`);
    }

    async getOperationStatus(deviceId: string, operationId: string): Promise<APIResponse> {
        return this.makeRequest(`/api/v2/devices/${deviceId}/operations/${operationId}`);
    }

    async getDeviceLogs(deviceId: string, format: 'json' | 'zip' = 'json', limit?: number): Promise<APIResponse> {
        const params = new URLSearchParams();
        if (format) params.append('format', format);
        if (limit) params.append('limit', limit.toString());
        
        const queryString = params.toString();
        const endpoint = `/api/devices/${deviceId}/logs${queryString ? `?${queryString}` : ''}`;
        
        return this.makeRequest(endpoint);
    }

    // Utility methods
    async pingDevice(deviceId: string): Promise<APIResponse> {
        // This could be implemented as a simple status check
        return this.getDeviceStatus(deviceId);
    }

    async getDeviceHealth(deviceId: string): Promise<APIResponse> {
        const statusResponse = await this.getDeviceStatus(deviceId);
        if (!statusResponse.success) {
            return statusResponse;
        }

        return {
            success: true,
            data: {
                deviceId,
                health: statusResponse.data?.health,
                timestamp: new Date().toISOString()
            }
        };
    }
}

// Create a singleton instance
export const deviceAPI = new DeviceAPI();
