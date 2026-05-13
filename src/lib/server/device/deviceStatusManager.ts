import { logger } from '$lib/server/logger';

/**
 * Manages device status updates through database
 * 
 * This class handles database updates for device connection status.
 * Presence tracking is handled by MQTT handlers, but database updates
 * are still needed for persistence and querying.
 * 
 * Used by:
 * - Message handlers (device connection/disconnection events)
 */
export class DeviceStatusManager {
    
    /**
     * Mark a device as online
     */
    static async setDeviceOnline(
        deviceId: string, 
        locals: App.Locals,
        connectionId?: string
    ): Promise<void> {
        try {
            // Update database
            const now = new Date();
            await locals.prisma.device.update({
                where: { id: deviceId },
                data: { 
                    connected: true, 
                    connectedAt: now,
                    lastUsedAt: now
                }
            });
            
            logger.info(`Device ${deviceId} marked as online (connection: ${connectionId || 'unknown'})`);
            
        } catch (error) {
            logger.error(`Failed to set device ${deviceId} online: ${error}`);
            throw error;
        }
    }
    
    /**
     * Mark a device as offline
     */
    static async setDeviceOffline(
        deviceId: string, 
        locals: App.Locals,
        connectionId?: string
    ): Promise<void> {
        try {
            // Update database
            await locals.prisma.device.update({
                where: { id: deviceId },
                data: { 
                    connected: false, 
                    disconnectedAt: new Date() 
                }
            });
            
            logger.info(`Device ${deviceId} marked as offline (connection: ${connectionId || 'unknown'})`);
            
        } catch (error) {
            logger.error(`Failed to set device ${deviceId} offline: ${error}`);
            throw error;
        }
    }
    
    /**
     * Manually control device status (useful for fake devices)
     */
    static async setDeviceStatus(
        deviceId: string,
        status: 'online' | 'offline',
        locals: App.Locals,
        connectionId?: string
    ): Promise<void> {
        if (status === 'online') {
            await this.setDeviceOnline(deviceId, locals, connectionId);
        } else {
            await this.setDeviceOffline(deviceId, locals, connectionId);
        }
    }
    
    /**
     * Batch update multiple devices
     */
    static async setMultipleDevicesStatus(
        deviceIds: string[],
        status: 'online' | 'offline',
        locals: App.Locals
    ): Promise<void> {
        const promises = deviceIds.map(deviceId => 
            this.setDeviceStatus(deviceId, status, locals)
        );
        
        await Promise.all(promises);
        logger.info(`Updated ${deviceIds.length} devices to ${status} status`);
    }
    
    /**
     * Update devices by pattern (name contains pattern)
     */
    static async setDevicesByPatternStatus(
        pattern: string,
        status: 'online' | 'offline',
        locals: App.Locals
    ): Promise<void> {
        try {
            // Find devices matching the pattern
            const devices = await locals.prisma.device.findMany({
                where: {
                    name: {
                        contains: pattern
                    }
                },
                select: { id: true, name: true }
            });
            
            if (devices.length === 0) {
                logger.warn(`No devices found matching pattern: ${pattern}`);
                return;
            }
            
            // Update all matching devices
            await this.setMultipleDevicesStatus(
                devices.map((d: { id: string; name: string }) => d.id), 
                status, 
                locals
            );
            
            logger.info(`Updated ${devices.length} devices matching pattern "${pattern}" to ${status} status`);
            
        } catch (error) {
            logger.error(`Failed to update devices by pattern "${pattern}": ${error}`);
            throw error;
        }
    }
}
