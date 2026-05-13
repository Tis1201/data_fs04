import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';


import type { UserInfo } from '$lib/server/types/user'; // adjust import as needed
import { logger } from '../logger';

export interface ExtractedUserInfoResult {
  userInfo: UserInfo;
  authMethod: 'apiKey' | 'session';
  error?: string;
}

type ValidatedAuth = Awaited<ReturnType<RequestEvent['locals']['auth']['validate']>>;

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

export async function userInfoByUserId(userId: string): Promise<UserInfo | null> {
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        systemRole: true,
        primaryAccountId: true
      }
    });

    if (!user) return null;
    
    // Load account memberships
    const memberships = await prisma.accountMembership.findMany({
      where: { userId: user.id, role: { not: 'SYSTEM' } },
      include: {
        account: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Determine current account
    let currentAccount = null;
    
    // Prioritize owner accounts first
    currentAccount = memberships.find(m => m.role === 'OWNER');
    
    // Then try primary account
    if (!currentAccount && user.primaryAccountId) {
      currentAccount = memberships.find(m => m.account.id === user.primaryAccountId);
    }
    
    // Finally fallback to first membership
    if (!currentAccount && memberships.length > 0) {
      currentAccount = memberships[0];
    }
    
    logger.debug(`User ${userId} has ${memberships.length} account memberships and current account: ${currentAccount?.account?.id || 'none'}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      systemRole: user.systemRole,
      source: 'session',
      memberships,
      currentAccount
    };
  } catch (err) {
    logger.error(`Error getting user info for user ${userId}: ${JSON.stringify(err)}`);
    return null;
  }
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

  logger.debug(`Extracted API key: ${apiKey}`);

  if (apiKey) {
    const userInfo: UserInfo | null = await userInfoByApiKey(apiKey);
    return userInfo || { error: 'Invalid API key' };
  }

  if (!event) {
    return { error: 'Event is required for session-based authentication' };
  }

  const auth = await event.locals.auth.validate();

  logger.debug(`Extracted auth: ${JSON.stringify(auth)}`);

  if (auth?.user) {
    // Get current account ID from cookie
    const currentAccountId = event.cookies.get('current_account_id');

    // Load account memberships
    const memberships = await event.locals.prisma.accountMembership.findMany({
      where: { userId: auth.user.id, role: { not: 'SYSTEM' } },
      include: {
        account: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Determine current account
    let currentAccount = null;
    
    // First try from cookie
    if (currentAccountId) {
      currentAccount = memberships.find(m => m.account.id === currentAccountId);
      // If cookie account is not an owner, prioritize finding an owner account
      if (currentAccount && currentAccount.role !== 'OWNER') {
        const ownerAccount = memberships.find(m => m.role === 'OWNER');
        if (ownerAccount) {
          currentAccount = ownerAccount;
        }
      }
    }
    
    // If no account selected yet, prioritize owner accounts
    if (!currentAccount) {
      currentAccount = memberships.find(m => m.role === 'OWNER');
    }
    
    // Then try primary account
    const primaryAccountId = (auth.user as any)?.primaryAccountId;
    if (!currentAccount && primaryAccountId) {
      currentAccount = memberships.find(m => m.account.id === primaryAccountId);
    }
    
    // Finally fallback to first membership
    if (!currentAccount && memberships.length > 0) {
      currentAccount = memberships[0];
    }
    
    // Set cookie for the selected account if it's different from cookie or if no cookie exists
    if (currentAccount && currentAccount.account.id !== currentAccountId && event) {
      try {
        // Set cookie for the selected account
        event.cookies.set('current_account_id', currentAccount.account.id, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 30 // 30 days
        });
      } catch (e) {
        // If we can't set the cookie (headers already sent), just continue with the current account
        console.warn('Could not set account cookie - headers may have already been sent');
      }
    }

    // Map Lucia's user object to your canonical UserInfo type
    const userInfo: UserInfo = {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name ?? null, // If name is not present, default to null
      systemRole: auth.user.systemRole,
      source: 'session',
      memberships,
      currentAccount
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
export function getUserId(auth: ValidatedAuth | null, throwOnMissing = false): string | undefined {
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
export function requireUserId(auth: ValidatedAuth | null): string {
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
export async function validateAuth(locals: RequestEvent['locals']): Promise<ValidatedAuth> {
  const auth = await locals.auth.validate();

  if (!auth) {
    throw error(401, 'Unauthorized');
  }

  return auth;
}

/**
 * Gets the current account ID from the auth object or throws a 403 error if not available
 * @param auth The auth object from locals.auth.validate()
 * @returns The current account ID (always returns a string)
 * @throws 403 error if current account ID is not available
 */
export function getCurrentAccountId(auth: ValidatedAuth | null): string {
  const accountId = auth?.currentAccount?.account?.id;
  
  if (!accountId) {
    throw error(403, 'No account selected. Please select an account first.');
  }
  
  return accountId;
}

/**
 * Gets the current account ID from locals and cookies (for use in +page.server.ts load functions)
 * Priority: locals.currentAccount > cookie > user.primaryAccountId
 * @param locals The locals object from request event
 * @param cookies The cookies object from request event
 * @param user Optional user object with primaryAccountId fallback
 * @returns The current account ID or undefined if not available
 */
export function getAccountIdFromLocals(
  locals: App.Locals,
  cookies: { get: (name: string) => string | undefined },
  user?: { primaryAccountId?: string | null }
): string | undefined {
  // Priority 1: From locals.currentAccount (set by auth middleware)
  const localsAccountId = (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
  if (localsAccountId) return localsAccountId;
  
  // Priority 2: From cookie
  const cookieAccountId = cookies.get('current_account_id');
  if (cookieAccountId) return cookieAccountId;
  
  // Priority 3: From user's primaryAccountId (fallback)
  if (user?.primaryAccountId) return user.primaryAccountId;
  
  return undefined;
}

/**
 * Gets the current account ID from locals and cookies, throws 403 if not available
 * @param locals The locals object from request event
 * @param cookies The cookies object from request event
 * @param user Optional user object with primaryAccountId fallback
 * @returns The current account ID (always returns a string)
 * @throws 403 error if account ID is not available
 */
export function requireAccountId(
  locals: App.Locals,
  cookies: { get: (name: string) => string | undefined },
  user?: { primaryAccountId?: string | null }
): string {
  const accountId = getAccountIdFromLocals(locals, cookies, user);
  
  if (!accountId) {
    throw error(403, 'No account selected. Please select an account first.');
  }
  
  return accountId;
}
