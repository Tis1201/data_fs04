// Device listening endpoint with API key authentication
// Uses the sseHandler utility for consistent SSE connection management

import { createSSEHandler } from '../../../../lib/server/sse/device/sseHandler';
import { auth_device } from '$lib/server/device/deviceAuth';
import type { ConnectionMeta } from '$lib/server/messaging/interfaces/connection';

/**
 * Handles GET requests to establish an SSE connection for device communication
 */
export const GET = createSSEHandler({
    /**
     * Authenticates the device and returns the connection metadata
     */
    authenticate: async (locals, request) => {
        const { device, userInfo } = await auth_device(locals, request);
        
        const connectionMeta: Omit<ConnectionMeta, 'id' | 'connectedAt'> = {
            userInfo,
            nodeId: 'node-1',
            protocol: 'sse',
            deviceId: device.id,
        };
        
        return { connectionMeta, device };
    },
    
    /**
     * Optional: Custom logic when a connection is established
     */
    onConnect: async ({ connectionId, device, locals }) => {
        // Additional custom logic when a device connects
        // The device status is automatically updated by default
    },
    
    /**
     * Optional: Custom logic when a connection is closed
     */
    onDisconnect: async ({ connectionId, device, locals }) => {
        // Additional cleanup when a device disconnects
        // The device status is automatically updated by default
    },
    
    /**
     * Whether to update device status in the database (default: true)
     */
    updateDeviceStatus: true
});
