import { logger } from '$lib/server/logger';
import type { App } from '$lib/types/app';
import { getPresenceManager, getMessageRelay } from '$lib/server/pushpin/middleware';

/**
 * Manages device status updates through database
 * This ensures consistent status tracking across all connection types (SSE, WebSocket, Pushpin)
 * Note: Redis is optional - if not available, only database updates are performed
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
            await locals.prisma.device.update({
                where: { id: deviceId },
                data: { 
                    connected: true, 
                    connectedAt: new Date() 
                }
            });
            
            // Update presence tracking and publish to Redis if available
            try {
                const presenceManager = getPresenceManager();
                const messageRelay = getMessageRelay();
                
                if (presenceManager) {
                    await presenceManager.setDeviceOnline(deviceId);
                }
                
                if (messageRelay) {
                    await messageRelay.publishDeviceStatus(deviceId, 'online', connectionId);
                } else {
                    // Fallback to direct Redis publish
                    const { getRedisService } = await import('$lib/server/services/redisService');
                    const redisService = getRedisService(locals);
                    if (redisService) {
                        await redisService.publish('device_status_changes', JSON.stringify({
                            deviceId,
                            status: 'online',
                            connectionId,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
                logger.debug(`Device ${deviceId} status published to Redis`);
            } catch (redisError) {
                logger.debug(`Redis not available, skipping publish for device ${deviceId}: ${redisError}`);
            }
            
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
            
            // Update presence tracking and publish to Redis if available
            try {
                const presenceManager = getPresenceManager();
                const messageRelay = getMessageRelay();
                
                if (presenceManager) {
                    await presenceManager.setDeviceOffline(deviceId);
                }
                
                if (messageRelay) {
                    await messageRelay.publishDeviceStatus(deviceId, 'offline', connectionId);
                } else {
                    // Fallback to direct Redis publish
                    const { getRedisService } = await import('$lib/server/services/redisService');
                    const redisService = getRedisService(locals);
                    if (redisService) {
                        await redisService.publish('device_status_changes', JSON.stringify({
                            deviceId,
                            status: 'offline',
                            connectionId,
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
                logger.debug(`Device ${deviceId} status published to Redis`);
            } catch (redisError) {
                logger.debug(`Redis not available, skipping publish for device ${deviceId}: ${redisError}`);
            }
            
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
                devices.map(d => d.id), 
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
