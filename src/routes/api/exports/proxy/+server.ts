/**
 * GET /api/exports/proxy?objectPath=exports/logs/xxx.csv
 * Proxy download for log exports. Validates objectPath under exports/logs/, fetches from CDN with HMAC.
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchFromCdn } from '$lib/server/storage/gcloudUrlUtils';
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

	if (objectPath.includes('..')) {
		throw error(400, 'Invalid objectPath');
	}

	const storageConfig = getStorageConfig();
	if (storageConfig.mode !== 'R2') {
		throw error(500, 'Export proxy only supports R2 mode');
	}

	const cdnRes = await fetchFromCdn(objectPath, { label: 'ExportProxy' });

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
