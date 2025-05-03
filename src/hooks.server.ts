import { lucia } from "$lib/server/auth/lucia";
import type { Handle } from "@sveltejs/kit";
import prisma from "$lib/server/prisma";
import { building } from "$app/environment";
import { whatsAppAccountManager } from "$lib/server/whatsapp/WhatsAppAccountManager";
import { DeviceManager } from "$lib/server/device/deviceManager";
import { websocketMiddleware } from "$lib/server/websocket/middleware";
import { authMiddleware } from "$lib/server/auth/middleware";
import { logger } from "$lib/server/logger";

// Initialize WhatsApp clients on server startup (not during build)
// Use a self-executing async function to avoid blocking the main thread
if (!building) {
    logger.info('STARTING WHATSAPP CLIENT INITIALIZATION FROM HOOKS');
    
    // Use a non-blocking approach with Promise
    (async () => {
        // try {
        //     // Delay initialization without blocking
        //     await new Promise(resolve => setTimeout(resolve, 1000));
            
        //     logger.info('DELAYED WHATSAPP CLIENT INITIALIZATION');
            
        //     // Initialize WhatsApp clients from database
        //     logger.info('Loading WhatsApp clients from database...');
        //     await whatsAppAccountManager.initializeClientsFromDatabase();
            
        //     logger.info('WhatsAppAccountManager is ready');
        // } catch (error) {
        //     logger.error('Error in WhatsApp initialization process', { error: error.message, stack: error.stack });
        // }
    })();
} 

// Device manager middleware to add deviceManager to locals
const deviceManagerMiddleware: Handle = async ({ event, resolve }) => {
    // Add deviceManager to locals
    event.locals.deviceManager = DeviceManager;
    
    return resolve(event);
};

// Combine middleware functions
export const handle: Handle = async ({ event, resolve }) => {
    // Chain middleware: auth -> device -> websocket
    return await authMiddleware({ 
        event, 
        resolve: () => deviceManagerMiddleware({
            event,
            resolve: () => websocketMiddleware({ event, resolve })
        })
    });
};
