import { json, type RequestHandler } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { generateDownloadUrl, generateDownloadUrlR2, getStorageConfig } from '$lib/server/storage';
import { parseR2Url, isR2Url } from '$lib/server/storage/gcloudUrlUtils';
import { PrismaClient } from '@prisma/client';

// Hardcoded API key for device agent installation
// TODO: Move to environment variable for production
const INSTALL_API_KEY = 'gXKC9oVonzK6WRtwRVBdjIBQQcJUYgx6vL2HUwcJ6UJoVd6iRW';

/**
 * Verify API key from Authorization header
 */
function verifyApiKey(request: Request): boolean {
	const authHeader = request.headers.get('authorization');
	if (!authHeader) {
		return false;
	}

	// Support both "Bearer TOKEN" and "API-Key TOKEN" formats
	const parts = authHeader.split(' ');
	if (parts.length !== 2) {
		return false;
	}

	const token = parts[1];
	return token === INSTALL_API_KEY;
}

/**
 * Extract object path from GCloud storage URL
 * Handles formats like:
 * - https://storage.googleapis.com/bucket-name/path/to/file.apk
 * - gs://bucket-name/path/to/file.apk
 * - Just the object path: path/to/file.apk
 */
function extractObjectPath(path: string): string {
	// If it's a full HTTPS URL
	if (path.startsWith('https://storage.googleapis.com/')) {
		const url = new URL(path);
		const pathParts = url.pathname.substring(1).split('/');
		if (pathParts.length > 1) {
			// Remove bucket name, keep the rest
			return pathParts.slice(1).join('/');
		}
		return pathParts[0];
	}

	// If it's a gs:// URL
	if (path.startsWith('gs://')) {
		const withoutProtocol = path.substring(5); // Remove 'gs://'
		const pathParts = withoutProtocol.split('/');
		if (pathParts.length > 1) {
			// Remove bucket name, keep the rest
			return pathParts.slice(1).join('/');
		}
		return pathParts[0];
	}

	// Otherwise, assume it's already an object path
	return path;
}

/**
 * GET /api/v2/install/apps/[id]/download
 * 
 * Get download URL for a specific app
 * Returns a presigned GCloud download URL that expires in 1 hour
 * 
 * Headers:
 * - Authorization: Bearer {INSTALL_API_KEY} or API-Key {INSTALL_API_KEY}
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "cmk7noedt00027g8b4f7pof8d",
 *     "name": "RadarEdge",
 *     "version": "1.1.0",
 *     "format": "apk",
 *     "packageName": "com.datarealities.radar.usb.app",
 *     "size": 109055963,
 *     "downloadUrl": "https://storage.googleapis.com/...",
 *     "expiresAt": "2026-01-18T13:00:00.000Z",
 *     "expiresInSeconds": 3600
 *   }
 * }
 */
export const GET: RequestHandler = async (event) => {
	const { request, params } = event;
	const { id } = params;

	try {
		// Verify API key
		if (!verifyApiKey(request)) {
			const clientIp = await event.getClientAddress();
			logger.warn('[InstallAppDownloadAPI] Unauthorized access attempt', {
				appId: id,
				clientIp,
				userAgent: request.headers.get('user-agent')
			});

			return json(
				{
					success: false,
					error: 'Unauthorized - Invalid or missing API key'
				},
				{ status: 401 }
			);
		}

		// Validate app ID
		if (!id || typeof id !== 'string') {
			return json(
				{
					success: false,
					error: 'Invalid app ID'
				},
				{ status: 400 }
			);
		}

		// Create Prisma client (without ZenStack - no user context needed)
		const prisma = new PrismaClient();

		try {
			// Fetch app resource
			const app = await prisma.resource.findUnique({
				where: { id },
				select: {
					id: true,
					name: true,
					description: true,
					type: true,
					version: true,
					format: true,
					packageName: true,
					path: true,
					size: true,
					createdAt: true,
					updatedAt: true
				}
			});

			if (!app) {
				const clientIp = await event.getClientAddress();
				logger.warn('[InstallAppDownloadAPI] App not found', {
					appId: id,
					clientIp
				});

				return json(
					{
						success: false,
						error: 'App not found'
					},
					{ status: 404 }
				);
			}

			// Verify it's an application resource
			if (app.type !== 'application') {
				return json(
					{
						success: false,
						error: 'Resource is not an application'
					},
					{ status: 400 }
				);
			}

			// Check if path exists
			if (!app.path) {
				const clientIp = await event.getClientAddress();
				logger.error('[InstallAppDownloadAPI] App missing path', {
					appId: id,
					clientIp
				});

				return json(
					{
						success: false,
						error: 'App resource is missing download path'
					},
					{ status: 500 }
				);
			}

			// Generate download URL (expires in 1 hour)
			const expiresSeconds = 3600; // 1 hour

			let downloadUrl: string;
			let expiresAt: string;

			const storageConfig = getStorageConfig();

			if (storageConfig.mode === 'R2') {
				// R2 mode: generate a presigned S3 URL (works without HMAC headers)
				let objectPath: string;

				if (isR2Url(app.path)) {
					const parsed = parseR2Url(app.path);
					objectPath = parsed?.objectPath ?? extractObjectPath(app.path);
				} else if (app.path.startsWith('https://') || app.path.startsWith('http://')) {
					// Generic HTTPS URL (e.g. legacy GCS) — extract the tail as object path
					objectPath = extractObjectPath(app.path);
				} else {
					objectPath = app.path;
				}

				const result = await generateDownloadUrlR2(
					storageConfig.r2Bucket,
					objectPath,
					expiresSeconds,
					app.name ?? undefined
				);
				downloadUrl = result.url;
				expiresAt = new Date(result.expires).toISOString();
			} else {
				// LOCAL mode
				const objectPath = extractObjectPath(app.path);
				try {
					const result = await generateDownloadUrl(objectPath, expiresSeconds, app.name ?? undefined);
					downloadUrl = result.url;
					expiresAt = new Date(result.expires).toISOString();
				} catch (storageError) {
					logger.warn('[InstallAppDownloadAPI] Failed to generate download URL, using original path', {
						appId: id,
						error: storageError instanceof Error ? storageError.message : String(storageError)
					});
					downloadUrl = app.path;
					expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
				}
			}

			const clientIp = await event.getClientAddress();
			logger.info('[InstallAppDownloadAPI] Download URL generated', {
				appId: id,
				name: app.name,
				packageName: app.packageName,
				version: app.version,
				format: app.format,
				clientIp
			});

			return json({
				success: true,
				data: {
					id: app.id,
					name: app.name,
					description: app.description,
					version: app.version,
					format: app.format,
					packageName: app.packageName,
					size: app.size,
					downloadUrl,
					expiresAt,
					expiresInSeconds: expiresSeconds
				}
			});
		} finally {
			await prisma.$disconnect();
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error('[InstallAppDownloadAPI] Error generating download URL', {
			appId: id,
			error: message,
			stack: err instanceof Error ? err.stack : undefined
		});

		return json(
			{
				success: false,
				error: 'Failed to generate download URL',
				details: { message }
			},
			{ status: 500 }
		);
	}
};
