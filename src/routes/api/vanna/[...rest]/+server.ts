import type { RequestHandler } from './$types';
import { validateApiAuth } from '$lib/server/auth/api-auth';
import { PUBLIC_VANNA_API_URL } from '$env/static/public';

const VANNA_URL = PUBLIC_VANNA_API_URL || 'http://localhost:8000';

/**
 * Proxy all requests to Vanna server with user context headers.
 * Supports SSE streaming for chat responses.
 */
export const POST: RequestHandler = async ({ request, cookies, params, locals }) => {
    // Check authentication from locals (populated by hooks/middleware)
    const session = await locals.auth.validate();
    if (!session) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Build target URL
    const path = params.rest;
    const targetUrl = `${VANNA_URL}/api/vanna/${path}`;

    // Get current account from locals (resolved by middleware)
    // @ts-ignore - types might not be fully updated in app.d.ts
    const currentAccount = locals.currentAccount;

    // Forward request with user headers
    const headers = new Headers(request.headers);
    headers.set('X-User-Id', session.user.id);
    headers.set('X-User-Email', session.user.email);
    headers.set('X-System-Role', session.user.systemRole);
    // Add shared secret for proxy authentication
    headers.set('X-Proxy-Secret', process.env.VANNA_PROXY_SECRET || 'dev-secret');

    if (currentAccount?.account?.id) {
        headers.set('X-Account-Id', currentAccount.account.id);
    } else {
        // Fallback for safety - Vanna needs an account context for RLS
        console.warn('[VannaProxy] No current account context found for user', session.user.id);
    }

    // Proxy the request
    const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: request.body,
        // @ts-ignore - duplex is needed for streaming request body
        duplex: 'half',
    });

    // Return response with streaming support
    return new Response(response.body, {
        status: response.status,
        headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/json',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
};
