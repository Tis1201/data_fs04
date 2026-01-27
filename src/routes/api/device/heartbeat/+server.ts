import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { getAdminPrisma } from '$lib/server/prisma';
import redis from '$lib/server/redis';

/**
 * POST /api/device/heartbeat
 * 
 * Receives heartbeat data from devices and stores it in ClickHouse.
 * Also updates Postgres with lastSeenAt and device info.
 * This endpoint is called by devices to report their system metrics.
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const data = await request.json();
        
        // Validate required fields
        if (!data.deviceId || !data.mac_lan) {
            return json({ 
                success: false, 
                error: 'Missing required fields: deviceId and mac_lan' 
            }, { status: 400 });
        }

        // Log heartbeat received
        logger.debug(`[Heartbeat] Received from device ${data.deviceId}`, {
            cpu_usage: data.cpu_usage,
            ram_usage: data.ram_usage,
            disk_usage: data.disk_usage,
            system_uptime_seconds: data.system_uptime_seconds,
            os_version: data.os_version
        });

        const now = new Date();

        // Update Postgres with lastSeenAt and device info
        try {
            const prisma = getAdminPrisma();
            
            // Build update data - only include fields that have values
            // Note: Device model uses lastUsedAt (not lastSeenAt)
            const updateData: Record<string, any> = {
                lastUsedAt: now,
                connected: true,
                connectedAt: now
            };
            
            // Update osVersion if provided and not empty
            if (data.os_version && data.os_version.trim()) {
                updateData.osVersion = data.os_version;
            }
            
            // Update deviceType based on os_version if it's currently 'dummy' or empty
            if (data.os_version && data.os_version.trim()) {
                // Map os_version to deviceType
                const osLower = data.os_version.toLowerCase();
                if (osLower.includes('darwin') || osLower.includes('macos')) {
                    updateData.deviceType = 'macOS';
                } else if (osLower.includes('linux')) {
                    updateData.deviceType = 'Linux';
                } else if (osLower.includes('windows')) {
                    updateData.deviceType = 'Windows';
                } else if (osLower.includes('android')) {
                    updateData.deviceType = 'Android';
                } else {
                    updateData.deviceType = data.os_version;
                }
            }
            
            await prisma.device.update({
                where: { id: data.deviceId },
                data: updateData
            });
            
            logger.debug(`[Heartbeat] Updated Postgres for device ${data.deviceId}`);
        } catch (pgError) {
            // Log but don't fail - Postgres update is secondary
            logger.warn(`[Heartbeat] Postgres update failed: ${pgError instanceof Error ? pgError.message : String(pgError)}`);
        }

        // Update Redis presence for real-time online status tracking
        try {
            if (redis) {
                const presenceKey = `presence:device:${data.deviceId}`;
                // Set presence key with 60 second TTL (will be refreshed by next heartbeat)
                // Using hash to store additional metadata
                await redis.hset(presenceKey, {
                    deviceId: data.deviceId,
                    timestamp: now.toISOString(),
                    source: 'heartbeat',
                    channel: `device:${data.deviceId}`,
                    mode: 'presence',
                    subscribers: '1'
                });
                // Set TTL to 60 seconds (device should send heartbeat every 30s)
                await redis.expire(presenceKey, 60);
                logger.debug(`[Heartbeat] Updated Redis presence for device ${data.deviceId}`);
            }
        } catch (redisError) {
            // Log but don't fail - Redis is optional for presence tracking
            logger.warn(`[Heartbeat] Redis presence update failed: ${redisError instanceof Error ? redisError.message : String(redisError)}`);
        }

        // Try to insert into ClickHouse
        try {
            const { getClickHouseClient } = await import('$lib/server/clickhouse/client');
            const client = getClickHouseClient();

            // Format datetime for ClickHouse (needs format: 'YYYY-MM-DD HH:MM:SS.sss')
            const clickhouseDateTime = now.toISOString().replace('T', ' ').replace('Z', '');
            
            await client.insert({
                table: 'device_information',
                values: [{
                    device_id: data.deviceId,
                    mac_lan: data.mac_lan,
                    mac_wifi: data.mac_wifi || data.mac_lan,
                    os_version: data.os_version || '',
                    firmware: data.firmware || '',
                    model: data.model || '',
                    network_interface: data.network_interface || '',
                    wifi_ssid: data.wifi_ssid || '',
                    signal_strength_dbm: data.signal_strength_dbm || -70,
                    public_ip: data.public_ip || '',
                    private_ip: data.private_ip || '',
                    cpu_usage: data.cpu_usage || 0,
                    ram_usage: data.ram_usage || 0,
                    disk_usage: data.disk_usage || 0,
                    system_uptime_seconds: data.system_uptime_seconds || 0,
                    orientation: data.orientation || '',
                    resolution: data.resolution || '',
                    timezone: data.timezone || '',
                    last_connected_at: clickhouseDateTime,
                    last_status_at: clickhouseDateTime,
                    created_at: clickhouseDateTime
                }],
                format: 'JSONEachRow'
            });

            logger.info(`[Heartbeat] Stored metrics for device ${data.deviceId} in ClickHouse`);
            
            return json({ 
                success: true, 
                message: 'Heartbeat received and stored' 
            });
        } catch (clickhouseError) {
            // ClickHouse might not be configured - log but don't fail
            const errorMsg = clickhouseError instanceof Error ? clickhouseError.message : String(clickhouseError);
            logger.error(`[Heartbeat] ClickHouse insert failed: ${errorMsg}`);
            
            return json({ 
                success: true, 
                message: 'Heartbeat received (ClickHouse not configured)',
                debug_error: errorMsg
            });
        }
    } catch (error) {
        logger.error(`[Heartbeat] Error processing heartbeat: ${error instanceof Error ? error.message : String(error)}`);
        return json({ 
            success: false, 
            error: 'Failed to process heartbeat' 
        }, { status: 500 });
    }
};
