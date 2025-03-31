import { WhatsAppClientManager } from './types';
import path from 'path';
import fs from 'fs';
import { logger } from '$lib/server/logger';

// Store for all active WhatsApp client instances
const clients: Map<string, WhatsAppClientManager> = new Map();

// Auth directory path
export const AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');

// Ensure auth directory exists
if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    logger.info(`Created WhatsApp auth directory at ${AUTH_DIR}`);
}

/**
 * Get a WhatsApp client by ID
 */
export function getClient(clientId: string): WhatsAppClientManager | undefined {
    return clients.get(clientId);
}

/**
 * Set a WhatsApp client in the store
 */
export function setClient(clientId: string, clientData: WhatsAppClientManager): void {
    clients.set(clientId, clientData);
}

/**
 * Remove a WhatsApp client from the store
 */
export function removeClient(clientId: string): boolean {
    return clients.delete(clientId);
}

/**
 * Get all WhatsApp clients
 */
export function getAllClients(): Map<string, WhatsAppClientManager> {
    return clients;
}

/**
 * Update a specific property of a WhatsApp client
 */
export function updateClient(clientId: string, updates: Partial<WhatsAppClientManager>): boolean {
    const client = clients.get(clientId);
    if (!client) return false;
    
    clients.set(clientId, { ...client, ...updates });
    return true;
}

/**
 * Check if a client exists in the store
 */
export function hasClient(clientId: string): boolean {
    return clients.has(clientId);
}
