import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';

const SUPERSET_URL = env.SUPERSET_BASE_URL ?? 'https://superset-dev.datarealities.com';
const DASHBOARD_ID = env.SUPERSET_DASHBOARD_ID ?? '8b01e0b9-578d-4d41-a1ab-3501427aa985';
const SUPERSET_USERNAME = env.SUPERSET_EMBED_USERNAME;
const SUPERSET_PASSWORD = env.SUPERSET_EMBED_PASSWORD;

export const GET = restrict(
    async () => {
        if (!SUPERSET_USERNAME || !SUPERSET_PASSWORD) {
            logger.error('Superset embed credentials are not configured');
            return json({ error: 'Superset embed credentials missing' }, { status: 500 });
        }

        const supersetBaseUrl = SUPERSET_URL.replace(/\/$/, '');

        try {
            // 1. Login to get access token and session cookies
            const loginResp = await fetch(`${supersetBaseUrl}/api/v1/security/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: SUPERSET_USERNAME,
                    password: SUPERSET_PASSWORD,
                    provider: 'db',
                    refresh: true
                })
            });

            if (!loginResp.ok) {
                const errText = await loginResp.text();
                logger.error(`Login failed: ${loginResp.statusText} - ${errText}`);
                return json({ error: `Login failed: ${loginResp.statusText}`, details: errText }, { status: 401 });
            }

            const loginData = await loginResp.json();
            const accessToken = loginData.access_token;

            // Extract session cookies from login response
            const setCookieHeader = loginResp.headers.get('set-cookie');
            logger.debug('Received Superset session cookies');

            // 2. Fetch CSRF token with Authorization header and cookies
            const csrfResp = await fetch(`${supersetBaseUrl}/api/v1/security/csrf_token/`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    Referer: SUPERSET_URL,
                    ...(setCookieHeader && { Cookie: setCookieHeader })
                }
            });

            if (!csrfResp.ok) {
                const errText = await csrfResp.text();
                logger.error(`CSRF fetch failed: ${csrfResp.statusText} - ${errText}`);
                return json({ error: `CSRF fetch failed: ${csrfResp.statusText}`, details: errText }, { status: 400 });
            }

            const csrfData = await csrfResp.json();
            const csrf = csrfData.result;

            if (!csrf) {
                logger.error(`No CSRF token in response: ${JSON.stringify(csrfData)}`);
                return json({ error: 'No CSRF token in response', details: csrfData }, { status: 400 });
            }

            logger.debug('Received Superset CSRF token');

            // Extract CSRF cookie from CSRF response
            const csrfSetCookieHeader = csrfResp.headers.get('set-cookie');
            logger.debug('Received Superset CSRF cookies');

            // Combine all cookies
            const allCookies = [setCookieHeader, csrfSetCookieHeader].filter(Boolean).join('; ');

            // 3. Request guest token with all cookies and CSRF header
            const guestTokenResp = await fetch(`${supersetBaseUrl}/api/v1/security/guest_token/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                    'X-CSRFToken': csrf,
                    Referer: SUPERSET_URL,
                    ...(allCookies && { Cookie: allCookies })
                },
                body: JSON.stringify({
                    user: {
                        username: 'embed-client',
                        first_name: 'Embed',
                        last_name: 'Client'
                    },
                    resources: [
                        {
                            type: 'dashboard',
                            id: DASHBOARD_ID
                        }
                    ],
                    rls: []
                })
            });

            if (!guestTokenResp.ok) {
                const errText = await guestTokenResp.text();
                logger.error(`Guest token request failed: ${guestTokenResp.statusText} - ${errText}`);
                return json(
                    { error: `Guest token request failed: ${guestTokenResp.statusText}`, details: errText },
                    { status: guestTokenResp.status }
                );
            }

            const guestTokenData = await guestTokenResp.json();

            if (!guestTokenData.token) {
                logger.error(`No token in response: ${JSON.stringify(guestTokenData)}`);
                return json({ error: 'No token in response', details: guestTokenData }, { status: 400 });
            }

            logger.debug('Successfully generated Superset guest token');

            return json({
                success: true,
                token: guestTokenData.token,
                iframeUrl: `${supersetBaseUrl}/embedded/${DASHBOARD_ID}?token=${guestTokenData.token}`
            });
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
            logger.error(`Error in guest token endpoint: ${errorMsg}`);
            return json({ error: 'Internal server error', details: errorMsg }, { status: 500 });
        }
    },
    [SystemRole.ADMIN]
);
