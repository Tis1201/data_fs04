import { error } from '@sveltejs/kit';
import type { Auth } from 'lucia';
import type { RequestEvent } from '@sveltejs/kit';

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
