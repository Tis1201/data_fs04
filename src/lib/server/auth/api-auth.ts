import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { lucia } from './lucia';
import { getUserIdFromApiKey, validateApiKey } from './api-key-utils';

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
        if (!isValid) {
            return {
                valid: false,
                authMethod: 'apiKey' as AuthMethod,
                response: json({ error: 'Invalid API key' }, { status: 403 })
            };
        }

        // API key is valid, get associated user
        const userId = await getUserIdFromApiKey(apiKey);
        if (!userId) {
            return {
                valid: false,
                authMethod: 'apiKey' as AuthMethod,
                response: json({ error: 'Invalid API key' }, { status: 403 })
            };
        }

        // For now, we don't check admin role for API key auth
        // This could be enhanced to check user roles if needed
        return {
            valid: true,
            authMethod: 'apiKey' as AuthMethod,
            userId
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
    if (!session) {
        return {
            valid: false,
            authMethod: 'session' as AuthMethod,
            response: json({ error: 'Unauthorized' }, { status: 401 })
        };
    }

    // Check admin role if required
    if (requireAdmin && user.systemRole !== 'ADMIN') {
        return {
            valid: false,
            authMethod: 'session' as AuthMethod,
            response: json({ error: 'Forbidden' }, { status: 403 })
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
    // Check for API key in Authorization header (Bearer token)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    // Check for API key in custom header
    return request.headers.get('X-API-Key') || undefined;
}
