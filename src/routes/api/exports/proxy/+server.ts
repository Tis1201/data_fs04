/**
 * GET /api/exports/proxy?objectPath=exports/logs/xxx.csv
 * Proxy download for log exports. Validates objectPath under exports/logs/, fetches from CDN with HMAC.
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateHmacDownloadUrl } from '$lib/server/storage/gcloudUrlUtils';
import { getStorageConfig } from '$lib/server/storage';

export const GET: RequestHandler = async ({ url, locals }) => {
	const session = await locals.auth?.validate?.();
	if (!session) {
		throw error(401, 'Unauthorized');
	}

	const objectPath = url.searchParams.get('objectPath');
	if (!objectPath || !objectPath.startsWith('exports/logs/')) {
		throw error(400, 'Invalid objectPath - must start with exports/logs/');
	}

	// Prevent path traversal
	if (objectPath.includes('..')) {
		throw error(400, 'Invalid objectPath');
	}

	const storageConfig = getStorageConfig();
	if (storageConfig.mode !== 'R2') {
		throw error(500, 'Export proxy only supports R2 mode');
	}

	const hmacResult = generateHmacDownloadUrl(objectPath);
	if (!hmacResult) {
		throw error(500, 'HMAC not configured (CLOUDFLARE_R2_CDN_URL, CLOUDFLARE_R2_ACCESS_HMAC)');
	}

	const cdnRes = await fetch(hmacResult.downloadUrl, {
		method: 'GET',
		headers: { 'x-timestamp': hmacResult.timestamp, 'x-mac': hmacResult.mac }
	});

	if (!cdnRes.ok) {
		throw error(cdnRes.status === 404 ? 404 : 502, 'Export file not available');
	}

	const contentType = cdnRes.headers.get('Content-Type') || 'application/octet-stream';
	const disposition = cdnRes.headers.get('Content-Disposition') || `attachment; filename="${objectPath.split('/').pop()}"`;

	return new Response(cdnRes.body, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': disposition
		}
	});
};
