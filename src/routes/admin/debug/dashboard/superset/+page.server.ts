import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

const SUPERSET_URL = 'https://superset-dev.datarealities.com';
const SUPERSET_USERNAME = 'admin';
const SUPERSET_PASSWORD = 'ctctPUTPUT0823';
const DASHBOARD_ID = '299074ce-1bb7-4096-8244-a96e03a401b1';

async function generateGuestToken(): Promise<string> {
	try {
		// 1. Login to get access token and session cookies
		const loginResp = await fetch(`${SUPERSET_URL}/api/v1/security/login`, {
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
			throw new Error(`Login failed: ${loginResp.statusText} - ${errText}`);
		}

		const loginData = await loginResp.json();
		const accessToken = loginData.access_token;

		// Extract session cookies from login response
		const setCookieHeader = loginResp.headers.get('set-cookie');
		logger.debug(`Login set-cookie: ${setCookieHeader}`);

		// 2. Fetch CSRF token with Authorization header and cookies
		const csrfResp = await fetch(`${SUPERSET_URL}/api/v1/security/csrf_token/`, {
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
			throw new Error(`CSRF fetch failed: ${csrfResp.statusText} - ${errText}`);
		}

		const csrfData = await csrfResp.json();
		const csrf = csrfData.result;

		if (!csrf) {
			throw new Error(`No CSRF token in response: ${JSON.stringify(csrfData)}`);
		}

		logger.debug(`Got CSRF token: ${csrf.substring(0, 20)}...`);

		// Extract CSRF cookie from CSRF response
		const csrfSetCookieHeader = csrfResp.headers.get('set-cookie');
		logger.debug(`CSRF set-cookie: ${csrfSetCookieHeader}`);

		// Combine all cookies
		const allCookies = [setCookieHeader, csrfSetCookieHeader].filter(Boolean).join('; ');

		// 3. Request guest token with all cookies and CSRF header
		const guestTokenResp = await fetch(`${SUPERSET_URL}/api/v1/security/guest_token/`, {
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
			logger.error(`Guest token request failed: status=${guestTokenResp.statusText}, body=${errText}`);
			throw new Error(`Guest token request failed: ${guestTokenResp.statusText} - ${errText}`);
		}

		const guestTokenData = await guestTokenResp.json();
		if (!guestTokenData.token) {
			throw new Error(`No token in response: ${JSON.stringify(guestTokenData)}`);
		}

		return guestTokenData.token;
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
		logger.error(`Failed to generate guest token: ${errorMsg}`);
		throw err;
	}
}

export const load = restrict(
	async () => {
		try {
			const guestToken = await generateGuestToken();
			const iframeUrl = `${SUPERSET_URL}/embedded/${DASHBOARD_ID}?token=${guestToken}`;

			return {
				guestToken,
				iframeUrl,
				supersetUrl: SUPERSET_URL,
				dashboardId: DASHBOARD_ID
			};
		} catch (err) {
			logger.error(`Error loading Superset debug page: ${JSON.stringify(err)}`);
			throw error(500, 'Failed to generate Superset guest token');
		}
	},
	[SystemRole.ADMIN]
) satisfies PageServerLoad;
