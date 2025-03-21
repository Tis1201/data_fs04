// take any path after /api/webhook and return a 200
import { json } from '@sveltejs/kit';
import { validateApiAuth } from '$lib/server/auth/api-auth';

export const POST = async ({ request, cookies }) => {
    // Extract API key from request headers
    const apiKey = request.headers.get('X-API-Key');

    // Validate the API key
    const auth = await validateApiAuth(cookies, false, apiKey);
    if (!auth.valid) {
        return auth.response;
    }

    const params = new URL(request.url).searchParams

    console.log(params);

    // Return a 200 response
    return json({ message: 'Webhook received successfully' }, { status: 200 });
};
