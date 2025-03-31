import fs from 'fs';
import path from 'path';
import { AUTH_DIR } from '../store';
import { logger } from '$lib/server/logger';
import baileys from '@whiskeysockets/baileys';
const { useMultiFileAuthState } = baileys;

/**
 * Get the authentication state for a WhatsApp client
 */
export async function getAuthState(clientId: string) {
    const clientAuthDir = path.join(AUTH_DIR, clientId);
    
    // Create auth directory if it doesn't exist
    if (!fs.existsSync(clientAuthDir)) {
        fs.mkdirSync(clientAuthDir, { recursive: true });
        logger.debug(`Created auth directory for client ${clientId}`);
    }
    
    return await useMultiFileAuthState(clientAuthDir);
}

/**
 * Find the correct client ID directory for a WhatsApp account
 * This handles cases where the client ID in the database doesn't match
 * the actual directory in the auth folder
 */
export function findClientIdDirectory(clientId: string): string | null {
    // First check if there's a directory with this exact client ID
    if (fs.existsSync(path.join(AUTH_DIR, clientId))) {
        const clientIdPath = path.join(AUTH_DIR, clientId);
        if (fs.statSync(clientIdPath).isDirectory()) {
            logger.debug(`Found exact client ID directory: ${clientId}`);
            return clientId;
        }
    }
    
    // If we couldn't find the exact client ID, look for non-pending directories
    try {
        const authDirContents = fs.readdirSync(AUTH_DIR);
        
        // Look for non-pending directories
        const nonPendingDirs = authDirContents
            .filter(item => {
                const itemPath = path.join(AUTH_DIR, item);
                return fs.statSync(itemPath).isDirectory() && !item.startsWith('pending_');
            });
            
        if (nonPendingDirs.length > 0) {
            // Use the first non-pending directory
            logger.debug(`Using non-pending directory: ${nonPendingDirs[0]}`);
            return nonPendingDirs[0];
        } else {
            // If no non-pending directories found, check for any directory
            const allDirs = authDirContents
                .filter(item => {
                    const itemPath = path.join(AUTH_DIR, item);
                    return fs.statSync(itemPath).isDirectory();
                });
                
            if (allDirs.length > 0) {
                // Use the first directory found
                logger.debug(`Using first available directory: ${allDirs[0]}`);
                return allDirs[0];
            }
        }
    } catch (error) {
        logger.error(`Error finding client ID directory: ${error}`);
    }
    
    return null;
}

/**
 * Get all auth directories in the auth folder
 */
export function getAllAuthDirectories(): string[] {
    try {
        return fs.readdirSync(AUTH_DIR).filter(dir => 
            fs.statSync(path.join(AUTH_DIR, dir)).isDirectory() && !dir.startsWith('pending_')
        );
    } catch (error) {
        logger.error(`Error getting auth directories: ${error}`);
        return [];
    }
}
