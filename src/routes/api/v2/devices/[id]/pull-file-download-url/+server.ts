import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { convertGCloudUrlToSignedDownloadUrl, getStorageConfig } from '$lib/server/storage';
import path from 'path';

/**
 * GET /api/v2/devices/[id]/pull-file-download-url
 * Generate presigned download URL for browser
 * Query params: logId
 */
export const GET = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: deviceId } = params;
	const { url } = event;
	const logId = url.searchParams.get('logId');

	if (!logId) {
		throw Object.assign(new Error('logId query parameter is required'), { status: 400 });
	}

	logger.info('[PullFileDownloadURL] Generating download URL', { deviceId, logId });

	// Verify device exists and user has access
	const device = await prisma.device.findUnique({
		where: { id: deviceId },
		select: {
			id: true,
			createdBy: true,
			accountId: true,
			account: {
				select: {
					members: {
						select: {
							userId: true
						}
					}
				}
			}
		}
	});

	if (!device) {
		throw Object.assign(new Error('Device not found'), { status: 404, code: ErrorCodes.NOT_FOUND });
	}

	// Check if user has access to this device
	if (!isAdmin) {
		const isOwner = device.createdBy === session.user.id;
		const isAccountMember =
			device.accountId &&
			device.account?.members?.some((member: { userId: string }) => member.userId === session.user.id);

		if (!isOwner && !isAccountMember) {
			throw Object.assign(
				new Error('Access denied to this device'),
				{ status: 403, code: ErrorCodes.FORBIDDEN }
			);
		}
	}

	// Look up action log by logId
	const actionLog = await prisma.deviceActionLog.findUnique({
		where: { id: logId },
		select: {
			id: true,
			deviceId: true,
			actionType: true,
			status: true,
			metadata: true
		}
	});

	if (!actionLog) {
		throw Object.assign(new Error('Action log not found'), { status: 404, code: 'LOG_NOT_FOUND' });
	}

	// Verify action log belongs to device
	if (actionLog.deviceId !== deviceId) {
		throw Object.assign(
			new Error('Action log does not belong to this device'),
			{ status: 403, code: ErrorCodes.FORBIDDEN }
		);
	}

	// Verify it's a pull_file or get_logs action
	if (actionLog.actionType !== 'pull_file' && actionLog.actionType !== 'get_logs') {
		throw Object.assign(
			new Error('Action log is not for a pull_file or get_logs operation'),
			{ status: 400, code: 'INVALID_ACTION' }
		);
	}

	// Only return download URL when upload has completed successfully.
	// objectPath is stored at initiation, but the file does not exist in GCS until the device finishes uploading.
	// Returning early here prevents the polling loop from triggering download at ~15% (incomplete file).
	if (actionLog.status !== 'success') {
		throw Object.assign(
			new Error('File upload not yet complete. Please wait for the device to finish uploading.'),
			{
				status: 400,
				code: 'UPLOAD_IN_PROGRESS',
				details: `Action status is '${actionLog.status}'; download URL is only available when status is 'success'`
			}
		);
	}

	// Extract objectPath from action log metadata
	const metadata = actionLog.metadata as any;
	const objectPath = metadata?.objectPath;
	const bucket = metadata?.bucket;

	if (!objectPath) {
		throw Object.assign(
			new Error('Object path not found in action log metadata'),
			{
				status: 400,
				code: 'MISSING_METADATA',
				details: 'The file upload may not have completed successfully'
			}
		);
	}

	// Validate objectPath format
	if (!objectPath.includes('/') && objectPath.length < 50) {
		throw Object.assign(
			new Error(
				`Invalid object path format. Expected full path like devices/{deviceId}/pull-files/{timestamp}/{fileName}`
			),
			{ status: 400, code: 'INVALID_OBJECT_PATH', details: `Received: ${objectPath}` }
		);
	}

	// Get storage config
	const storageConfig = getStorageConfig();
	const storageBucket = bucket || (storageConfig.mode === 'R2' ? storageConfig.r2Bucket : null);

	if (storageConfig.mode === 'R2' && !storageBucket) {
		throw Object.assign(
			new Error('R2 bucket not configured (CLOUDFLARE_R2_BUCKET_NAME)'),
			{ status: 500, code: 'CONFIGURATION_ERROR' }
		);
	}

	// Extract filename from objectPath
	const fileName = path.basename(objectPath);

	// Generate download URL (HMAC only for R2 - returns proxy URL for same-origin fetch)
	let downloadUrlResult: { url: string; expires: number };

	if (storageConfig.mode === 'R2' && storageBucket) {
		const result = await convertGCloudUrlToSignedDownloadUrl(objectPath, 3600, fileName);
		if (!result || !result.downloadAuth) {
			throw Object.assign(
				new Error('HMAC required for R2. Set CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC.'),
				{ status: 500, code: 'CONFIGURATION_ERROR' }
			);
		}
		const origin = url.origin;
		downloadUrlResult = {
			url: `${origin}/api/v2/devices/${deviceId}/pull-file-download-proxy?logId=${encodeURIComponent(logId)}`,
			expires: result.expires
		};
	} else if (storageConfig.mode === 'LOCAL') {
		const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
		const pathForUrl = objectPath.startsWith('/') ? objectPath : `/uploads/iot/${objectPath}`;
		downloadUrlResult = {
			url: `${baseUrl.replace(/\/$/, '')}${pathForUrl}`,
			expires: Date.now() + 3600 * 1000
		};
	} else {
		throw Object.assign(
			new Error('Storage mode not supported for download'),
			{ status: 500, code: 'CONFIGURATION_ERROR' }
		);
	}

	// Mark action log as downloaded
	try {
		await prisma.deviceActionLog.update({
			where: { id: logId },
			data: {
				metadata: {
					...metadata,
					downloaded: true,
					downloadedAt: new Date().toISOString()
				}
			}
		});
	} catch (updateError) {
		logger.warn('[PullFileDownloadURL] Failed to update action log metadata', {
			error: updateError,
			logId
		});
	}

	logger.info('[PullFileDownloadURL] Download URL generated successfully', {
		logId,
		objectPath
	});

	return successResponse(
		{
			downloadUrl: downloadUrlResult.url,
			fileName,
			objectPath,
			expires: downloadUrlResult.expires
		},
		{ requestId: context.requestId }
	);
});

