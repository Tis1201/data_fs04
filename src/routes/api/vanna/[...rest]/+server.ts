import type { RequestHandler } from './$types';
import { validateApiAuth } from '$lib/server/auth/api-auth';
import { PUBLIC_VANNA_API_URL } from '$env/static/public';

const VANNA_URL = PUBLIC_VANNA_API_URL || 'http://localhost:8000';

/**
 * Proxy all requests to Vanna server with user context headers.
 * Supports SSE streaming for chat responses.
 */
export const POST: RequestHandler = async ({ request, cookies, params }) => {
    // Validate session
    const auth = await validateApiAuth(cookies);
    if (!auth.valid) {
        return auth.response!;
    }

    // Build target URL
    const path = params.rest;
    const targetUrl = `${VANNA_URL}/api/vanna/${path}`;

    // Forward request with user headers
    const headers = new Headers(request.headers);
    headers.set('X-User-Id', auth.userId || auth.user?.id || 'anonymous');
    headers.set('X-User-Email', auth.userInfo?.email || auth.user?.email || '');
    headers.set('X-System-Role', auth.userInfo?.systemRole || auth.user?.systemRole || 'user');
    if (auth.userInfo?.currentAccount?.account?.id) {
        headers.set('X-Account-Id', auth.userInfo.currentAccount.account.id);
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
