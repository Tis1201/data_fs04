import type { RequestHandler } from './$types';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { generatePresignedUrl, generateFilePath } from '$lib/server/storage';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/upload/presigned-url
 * Generate a presigned URL for cloud storage uploads
 * Unified endpoint for both admin and user
 */
export const POST: RequestHandler = unifiedEndpoint(
	async ({ context }) => {
		const { request } = context;
		
		const { fileName, contentType, expiresSeconds = 600 } = await request.json();

		if (!fileName) {
			return {
				success: false,
				error: {
					code: ErrorCodes.INVALID_INPUT,
					message: 'fileName is required'
				}
			};
		}

		// Infer content type from file extension if not provided
		let inferredContentType = contentType;
		if (!inferredContentType || inferredContentType.trim() === '') {
			const extension = fileName.split('.').pop()?.toLowerCase();
			const mimeTypes: Record<string, string> = {
				'apk': 'application/vnd.android.package-archive',
				'cpk': 'application/octet-stream',
				'bin': 'application/octet-stream',
				'exe': 'application/x-msdownload',
				'sh': 'application/x-sh',
				'zip': 'application/zip',
				'tar': 'application/x-tar',
				'gz': 'application/gzip',
				'pdf': 'application/pdf',
				'txt': 'text/plain',
				'json': 'application/json',
				'xml': 'application/xml',
				'jpg': 'image/jpeg',
				'jpeg': 'image/jpeg',
				'png': 'image/png',
				'gif': 'image/gif',
				'webp': 'image/webp',
				'mp4': 'video/mp4',
				'avi': 'video/x-msvideo',
				'mov': 'video/quicktime',
				'mp3': 'audio/mpeg',
				'wav': 'audio/wav'
			};
			inferredContentType = mimeTypes[extension || ''] || 'application/octet-stream';
			logger.info(`[PresignedURL] Inferred content type for ${fileName}: ${inferredContentType}`);
		}

		// Create a mock file object to generate the file path
		const mockFile = {
			name: fileName,
			type: inferredContentType
		} as File;

		const objectPath = generateFilePath(mockFile);
		
		logger.info(`[PresignedURL] Generating presigned URL for: ${objectPath} (${inferredContentType})`);

		const result = await generatePresignedUrl(objectPath, inferredContentType, expiresSeconds);

		return {
			success: true,
			data: result
		};
	},
	{ permission: 'resource.create' }
);

