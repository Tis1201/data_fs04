import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { lucia } from './lucia';
import { getUserIdFromApiKey, validateApiKey, getUserInfoFromApiKey } from './api-key-utils';

/**
 * Authentication method types
 */
export type AuthMethod = 'session' | 'apiKey' | 'none';

/**
 * Validate API request authentication using either session cookie or API key
 * @param cookies Request cookies
 * @param requireAdmin Whether to require admin role
 * @param apiKey Optional API key for API key authentication
 * @returns Object with validation result and response (if authentication failed)
 */
export async function validateApiAuth(cookies: Cookies, requireAdmin = false, apiKey?: string) {
    // Try API key authentication if provided
    if (apiKey) {
        const isValid = await validateApiKey(apiKey);
        const userId = isValid ? await getUserIdFromApiKey(apiKey) : null;
        const userInfo = isValid ? await getUserInfoFromApiKey(apiKey) : null;
        
        if (!isValid || !userId) {
            return {
                valid: false,
                authMethod: 'apiKey' as AuthMethod,
                response: json({ error: 'Invalid API key' }, { status: 403 })
            };
        }

        return {
            valid: true,
            authMethod: 'apiKey' as AuthMethod,
            userId,
            userInfo
        };
    }

    // Fall back to session authentication
    const sessionId = cookies.get(lucia.sessionCookieName);
    if (!sessionId) {
        return {
            valid: false,
            authMethod: 'none' as AuthMethod,
            response: json({ error: 'Unauthorized' }, { status: 401 })
        };
    }

    // Validate session
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || (requireAdmin && user.systemRole !== 'ADMIN')) {
        return {
            valid: false,
            authMethod: 'session' as AuthMethod,
            response: json({ error: requireAdmin ? 'Forbidden' : 'Unauthorized' }, { status: requireAdmin ? 403 : 401 })
        };
    }

    return {
        valid: true,
        authMethod: 'session' as AuthMethod,
        session,
        user
    };
}

/**
 * Helper function to extract API key from request headers
 * @param request The request object
 * @returns The API key if found, undefined otherwise
 */
export function extractApiKey(request: Request): string | undefined {
    // Prioritize X-API-Key header for simplicity
    return request.headers.get('X-API-Key') || 
           (request.headers.get('Authorization')?.startsWith('Bearer ') ? 
            request.headers.get('Authorization')?.substring(7) : 
            undefined);
}
