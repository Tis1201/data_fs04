import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { deleteFileFromCloudStorage } from '$lib/server/storage';

/**
 * POST /api/v2/upload/cleanup
 * Clean up failed uploads by deleting files from cloud storage
 * Unified endpoint for both admin and user
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ context }) => {
		const { request, prisma } = context;
		
		const { filePath, resourceId } = await request.json();
		
		if (!filePath) {
			return {
				success: false,
				error: {
					code: ErrorCodes.INVALID_INPUT,
					message: 'File path is required'
				}
			};
		}

		logger.info(`[UploadCleanup] Cleaning up failed upload: ${filePath}`);
		
		// Delete the file from cloud storage
		try {
			await deleteFileFromCloudStorage(filePath);
			logger.info(`[UploadCleanup] Successfully cleaned up file: ${filePath}`);
		} catch (deleteError) {
			logger.error(`[UploadCleanup] Failed to delete file from storage: ${deleteError}`);
			// Don't fail the request if file deletion fails - it might already be deleted
		}

		// If resourceId is provided, delete the database record
		if (resourceId) {
			try {
				await prisma.resource.delete({
					where: { id: resourceId }
				});
				logger.info(`[UploadCleanup] Deleted resource record: ${resourceId}`);
			} catch (dbError) {
				logger.error(`[UploadCleanup] Failed to delete resource record: ${dbError}`);
				// Don't fail - resource might not exist yet
			}
		}

		return {
			success: true,
			data: {
				message: 'Cleanup completed',
				filePath,
				resourceId
			}
		};
	},
	{ permission: 'resource.create' }
);

