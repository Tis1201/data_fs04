/**
 * Main application process
 * Handles: WhatsApp, Device Presence Monitor, and core middleware
 * Run with: npm run dev
 */

import { logger } from "$lib/server/logger";
import { whatsAppAccountManager } from "$lib/server/whatsapp/WhatsAppAccountManager";
import { ensureActiveSetting } from "$lib/server/settings";
import { startDevicePresenceMonitor } from "$lib/server/device/devicePresenceMonitor";
import redis from "$lib/server/redis";

export async function initializeMainProcess() {
    logger.info('🚀 Starting main application process...');

    try {
        // Initialize WhatsApp clients from database
        logger.info('Loading WhatsApp clients from database...');
        await whatsAppAccountManager.initializeClientsFromDatabase();

        await ensureActiveSetting();
        logger.info('WhatsAppAccountManager is ready');

        // Start device presence monitor (if Redis/Pushpin enabled)
        if (redis) {
            try {
                startDevicePresenceMonitor(redis);
                logger.info('Device presence monitor started');
            } catch (e: any) {
                logger.warn(`Failed to start device presence monitor: ${e?.message || String(e)}`);
            }
        }

        logger.info('✅ Main application process initialized successfully');
    } catch (error: unknown) {
        const e = error as any;
        logger.error('❌ Error in main process initialization', { 
            error: e?.message, 
            stack: e?.stack 
        });
        throw error;
    }
}

