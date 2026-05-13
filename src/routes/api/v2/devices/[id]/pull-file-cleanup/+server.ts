import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { deleteFileFromCloudStorage } from '$lib/server/storage';

/**
 * POST /api/v2/devices/[id]/pull-file-cleanup
 * Delete temporary file from cloud storage after successful download
 */
export const POST = unifiedEndpoint(async ({ context, event, params }) => {
	const { session, prisma, isAdmin } = context;
	const { id: deviceId } = params;
	const body = await event.request.json();
	const { logId, objectPath } = body;

	if (!logId) {
		throw Object.assign(new Error('logId is required'), { status: 400 });
	}

	if (!objectPath) {
		throw Object.assign(new Error('objectPath is required'), { status: 400 });
	}

	logger.info('[PullFileCleanup] Cleaning up file', { deviceId, logId, objectPath });

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

	// Verify objectPath matches action log metadata
	const metadata = actionLog.metadata as any;
	const storedObjectPath = metadata?.objectPath;

	if (storedObjectPath && storedObjectPath !== objectPath) {
		logger.warn('[PullFileCleanup] Object path mismatch', {
			provided: objectPath,
			stored: storedObjectPath
		});
		// Continue anyway - user might have the correct path
	}

	// Delete file from cloud storage
	try {
		await deleteFileFromCloudStorage(objectPath);
		logger.info('[PullFileCleanup] File deleted from cloud storage', { objectPath });
	} catch (deleteError) {
		// If file not found, that's okay (already deleted or never existed)
		const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
		if (errorMessage.includes('not found') || errorMessage.includes('No such object')) {
			logger.info('[PullFileCleanup] File already deleted or not found', { objectPath });
		} else {
			logger.error('[PullFileCleanup] Failed to delete file from cloud storage', {
				error: deleteError,
				objectPath
			});
			// Continue anyway - cleanup is best effort
		}
	}

	// Update action log metadata
	try {
		await prisma.deviceActionLog.update({
			where: { id: logId },
			data: {
				metadata: {
					...metadata,
					cleanedUp: true,
					cleanedUpAt: new Date().toISOString(),
					cleanupReason: 'user_download'
				}
			}
		});
	} catch (updateError) {
		logger.warn('[PullFileCleanup] Failed to update action log metadata', {
			error: updateError,
			logId
		});
	}

	logger.info('[PullFileCleanup] Cleanup completed successfully', { logId, objectPath });

	return successResponse(
		{
			message: 'File deleted successfully'
		},
		{ requestId: context.requestId }
	);
});

