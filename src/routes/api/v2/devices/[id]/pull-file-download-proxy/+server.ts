import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { generateHmacDownloadUrl } from '$lib/server/storage/gcloudUrlUtils';
import { getStorageConfig } from '$lib/server/storage';
import path from 'path';

/**
 * GET /api/v2/devices/[id]/pull-file-download-proxy?logId={logId}
 * Proxy download for HMAC-authenticated CDN files.
 * Avoids CORS: browser fetches same-origin; server fetches CDN with HMAC and streams back.
 */
export const GET = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: deviceId } = params;
	const logId = event.url.searchParams.get('logId');

	if (!logId) {
		throw Object.assign(new Error('logId query parameter is required'), { status: 400 });
	}

	// Same auth logic as pull-file-download-url
	const device = await prisma.device.findUnique({
		where: { id: deviceId },
		select: {
			id: true,
			createdBy: true,
			accountId: true,
			account: {
				select: {
					members: { select: { userId: true } }
				}
			}
		}
	});

	if (!device) {
		throw Object.assign(new Error('Device not found'), { status: 404, code: ErrorCodes.NOT_FOUND });
	}

	if (!isAdmin) {
		const isOwner = device.createdBy === session.user.id;
		const isAccountMember =
			device.accountId &&
			device.account?.members?.some((m: { userId: string }) => m.userId === session.user.id);
		if (!isOwner && !isAccountMember) {
			throw Object.assign(new Error('Access denied'), { status: 403, code: ErrorCodes.FORBIDDEN });
		}
	}

	const actionLog = await prisma.deviceActionLog.findUnique({
		where: { id: logId },
		select: { id: true, deviceId: true, actionType: true, status: true, metadata: true }
	});

	if (!actionLog || actionLog.deviceId !== deviceId) {
		throw Object.assign(new Error('Action log not found'), { status: 404 });
	}

	const allowedTypes = ['pull_file', 'get_logs', 'take_screenshot'];
	if (!allowedTypes.includes(actionLog.actionType || '')) {
		throw Object.assign(new Error('Invalid action type'), { status: 400 });
	}

	if (actionLog.status !== 'success') {
		throw Object.assign(
			new Error('File upload not yet complete'),
			{ status: 400, code: 'UPLOAD_IN_PROGRESS' }
		);
	}

	const metadata = actionLog.metadata as Record<string, unknown>;
	const objectPath = metadata?.objectPath as string | undefined;

	if (!objectPath || !objectPath.includes('/')) {
		throw Object.assign(new Error('Object path not found'), { status: 400 });
	}

	const storageConfig = getStorageConfig();
	if (storageConfig.mode !== 'R2') {
		throw Object.assign(new Error('Proxy only supports R2 mode'), { status: 500 });
	}

	const hmacResult = generateHmacDownloadUrl(objectPath);
	if (!hmacResult) {
		throw Object.assign(
			new Error('HMAC not configured (CLOUDFLARE_R2_CDN_URL, CLOUDFLARE_R2_ACCESS_HMAC)'),
			{ status: 500 }
		);
	}

	const fileName = path.basename(objectPath);

	logger.info('[PullFileDownloadProxy] Fetching from CDN', {
		logId,
		deviceId,
		objectPath: objectPath.slice(0, 60) + '...',
		fileName
	});

	const cdnRes = await fetch(hmacResult.downloadUrl, {
		method: 'GET',
		headers: {
			'x-timestamp': hmacResult.timestamp,
			'x-mac': hmacResult.mac
		}
	});

	if (!cdnRes.ok) {
		logger.error('[PullFileDownloadProxy] CDN fetch failed', {
			status: cdnRes.status,
			objectPath,
			deviceId
		});
		throw Object.assign(
			new Error(`CDN returned ${cdnRes.status}`),
			{ status: cdnRes.status === 403 ? 502 : 502 }
		);
	}

	const contentType = cdnRes.headers.get('Content-Type') || 'application/octet-stream';

	logger.info('[PullFileDownloadProxy] CDN fetch success, streaming to client', {
		logId,
		contentType,
		contentLength: cdnRes.headers.get('Content-Length')
	});

	return new Response(cdnRes.body, {
		status: 200,
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '\\"')}"`
		}
	});
});
