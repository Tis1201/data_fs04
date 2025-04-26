import { error } from '@sveltejs/kit';
import type { Auth } from 'lucia';
import type { RequestEvent } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';


import type { UserInfo } from '$lib/server/types/user'; // adjust import as needed

export interface ExtractedUserInfoResult {
  userInfo: UserInfo;
  authMethod: 'apiKey' | 'session';
  error?: string;
}

/**
 * Extracts the API key from a request (query param or header).
 */
export function extractApiKey(request: Request | import('http').IncomingMessage): string | null {
  // Try query param (works for both types if .url exists)
  const urlString = 'url' in request ? request.url : undefined;
  if (urlString) {
    const url = new URL(urlString, 'http://localhost');
    const apiKey = url.searchParams.get('apiKey');
    if (apiKey) return apiKey;
  }

  // SvelteKit Request
  if ('headers' in request && typeof (request.headers as Headers).get === 'function') {
    return (request.headers as Headers).get('x-api-key') || null;
  }
  // Node.js IncomingMessage (WebSocket)
  if ('headers' in request && typeof request.headers === 'object' && !(request.headers as Headers).get) {
    // headers are lowercased in Node.js
    const key = (request.headers as Record<string, string | string[] | undefined>)['x-api-key'];
    if (Array.isArray(key)) return key[0] || null;
    return key || null;
  }

  return null;
}


export async function userInfoByApiKey(key: string): Promise<UserInfo | null> {
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
            id: true,
            email: true,
            name: true,
            systemRole: true
          }
        }
      }
    });

    if (!apiKey?.user) return null;

    const { id, email, name, systemRole } = apiKey.user;
    return {
      id,
      email,
      name,
      systemRole,
      source: 'apiKey'
    };
  } catch (error) {
    console.error('Error getting user info from API key:', error);
    return null;
  }
}

export async function extractUserInfoFromRequest(
  request: Request,
  event?: RequestEvent // optional, only for session-based auth
): Promise<UserInfo | { error: string }> {

  const apiKey = extractApiKey(request);

  if (apiKey) {
    const userInfo: UserInfo | null = await userInfoByApiKey(apiKey);
    return userInfo || { error: 'Invalid API key' };
  }

  const auth = await event?.locals.auth.validate();

  if (auth?.user) {
    // Map Lucia's user object to your canonical UserInfo type
    const userInfo: UserInfo = {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name ?? null, // If name is not present, default to null
      systemRole: auth.user.systemRole,
      source: 'session'
    };
    return userInfo;
  }

  return { error: 'No authentication method provided' };
}

/**
 * Safely gets the user ID from an auth object
 * @param auth The auth object from locals.auth.validate()
 * @param throwOnMissing Whether to throw a 401 error if user ID is missing
 * @returns The user ID or undefined if not available
 */
export function getUserId(auth: Auth | null, throwOnMissing = false): string | undefined {
  const userId = auth?.user?.id;

  if (!userId && throwOnMissing) {
    throw error(401, 'Unauthorized: User ID not available');
  }

  return userId;
}

/**
 * Gets the user ID from an auth object or throws a 401 error if not available
 * @param auth The auth object from locals.auth.validate()
 * @returns The user ID (always returns a string)
 * @throws 401 error if user ID is not available
 */
export function requireUserId(auth: Auth | null): string {
  const userId = getUserId(auth);

  if (!userId) {
    throw error(401, 'Unauthorized: User ID required');
  }

  return userId;
}

/**
 * Validates auth from locals and returns the user ID
 * @param locals The locals object from a request event
 * @returns The user ID
 * @throws 401 error if user is not authenticated
 */
export async function validateAndGetUserId(locals: RequestEvent['locals']): Promise<string> {
  const auth = await locals.auth.validate();
  return requireUserId(auth);
}

/**
 * Validates auth from locals and returns the auth object
 * @param locals The locals object from a request event
 * @returns The auth object
 */
export async function validateAuth(locals: RequestEvent['locals']): Promise<Auth> {
  const auth = await locals.auth.validate();

  if (!auth) {
    throw error(401, 'Unauthorized');
  }

  return auth;
}
