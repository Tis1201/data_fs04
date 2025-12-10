import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { generatePresignedUrl, generateFilePath } from '$lib/server/storage';
import { logger } from '$lib/server/logger';

/**
 * POST /api/v2/upload/presigned-url
 * Generate a presigned URL for file upload to cloud storage
 * 
 * Body:
 * - fileName: string (required) - Name of file to upload
 * - contentType: string (optional) - MIME type (will be inferred if missing)
 * - expiresSeconds: number (optional, default: 600) - URL expiration time
 * 
 * Returns:
 * - url: string - Presigned upload URL
 * - objectPath: string - Cloud storage object path
 * - expiresAt: string - Expiration timestamp
 */
export const POST = unifiedEndpoint(
  async ({ context, event }) => {
    const { fileName, contentType, expiresSeconds = 600 } = await event.request.json();

    if (!fileName) {
      throw Object.assign(
        new Error('fileName is required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Infer content type from file extension if not provided
    let inferredContentType = contentType;
    if (!inferredContentType || inferredContentType.trim() === '') {
      const extension = fileName.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        apk: 'application/vnd.android.package-archive',
        cpk: 'application/octet-stream',
        bin: 'application/octet-stream',
        exe: 'application/x-msdownload',
        sh: 'application/x-sh',
        zip: 'application/zip',
        tar: 'application/x-tar',
        gz: 'application/gzip',
        pdf: 'application/pdf',
        txt: 'text/plain',
        json: 'application/json',
        xml: 'application/xml',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        mp4: 'video/mp4',
        avi: 'video/x-msvideo',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        wav: 'audio/wav'
      };
      inferredContentType = mimeTypes[extension || ''] || 'application/octet-stream';
      logger.info(`Inferred content type for ${fileName}: ${inferredContentType}`);
    }

    // Create a mock file object to generate the file path
    const mockFile = {
      name: fileName,
      type: inferredContentType
    } as File;

    const objectPath = generateFilePath(mockFile);

    logger.info(`Generating presigned URL for: ${objectPath} (${inferredContentType})`);

    const result = await generatePresignedUrl(objectPath, inferredContentType, expiresSeconds);

    return successResponse(result);
  },
  { permission: 'upload.create' }
);
