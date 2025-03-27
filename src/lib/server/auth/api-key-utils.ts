import prisma from '$lib/server/prisma';

/**
 * Check if an API key exists and is valid
 * @param key The API key to validate
 * @returns True if the API key exists and is valid, false otherwise
 */
export async function validateApiKey(key: string): Promise<boolean> {
    if (!key) return false;
    
    try {
        const apiKey = await prisma.apiKey.findFirst({
            where: {
                key,
                active: true
            }
        });
        
        return !!apiKey;
    } catch (error) {
        console.error('Error validating API key:', error);
        return false;
    }
}

/**
 * Get user ID associated with an API key
 * @param key The API key
 * @returns User ID if the API key is valid, null otherwise
 */
export async function getUserIdFromApiKey(key: string): Promise<string | null> {
    if (!key) return null;
    
    try {
        const apiKey = await prisma.apiKey.findFirst({
            where: {
                key,
                active: true
            },
            select: {
                userId: true,
                user: {
                    select: {
                        email: true,
                        name: true
                    }
                }
            }
        });
        
        return apiKey?.userId || null;
    } catch (error) {
        console.error('Error getting user from API key:', error);
        return null;
    }
}

/**
 * Get user information associated with an API key
 * @param key The API key
 * @returns User information if the API key is valid, null otherwise
 */
export async function getUserInfoFromApiKey(key: string): Promise<{
    email: string;
    name: string | null;
} | null> {
    if (!key) return null;
    
    try {
        const apiKey = await prisma.apiKey.findFirst({
            where: {
                key,
                active: true
            },
            select: {
                user: {
                    select: {
                        email: true,
                        name: true
                    }
                }
            }
        });
        
        return apiKey?.user || null;
    } catch (error) {
        console.error('Error getting user info from API key:', error);
        return null;
    }
}
