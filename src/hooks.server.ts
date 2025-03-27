import { lucia } from "$lib/server/auth/lucia";
import type { Handle } from "@sveltejs/kit";
import prisma from "$lib/server/prisma";
import { building } from "$app/environment";
import { initializeClientsFromDatabase } from "$lib/server/bailey/client";
import { websocketMiddleware } from "$lib/server/websocket/middleware";
import { authMiddleware } from "$lib/server/auth/middleware";

// Initialize WhatsApp clients on server startup (not during build)
if (!building) {
    console.error('=== STARTING WHATSAPP CLIENT INITIALIZATION FROM HOOKS ===');
    // Use setTimeout to ensure this runs after the server has fully started
    setTimeout(() => {
        console.error('=== DELAYED WHATSAPP CLIENT INITIALIZATION ===');
        initializeClientsFromDatabase().catch(error => {
            console.error('Failed to initialize WhatsApp clients:', error);
        });
    }, 1000);
}

// Combine middleware functions
export const handle: Handle = async ({ event, resolve }) => {
    // Run auth middleware first
    return await authMiddleware({ 
        event, 
        resolve: () => websocketMiddleware({ event, resolve })
    });
};
