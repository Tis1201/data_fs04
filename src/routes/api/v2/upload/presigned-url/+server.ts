import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { generatePresignedUrl, generateFilePath, deleteFilesFromCloudStorageByPrefix } from '$lib/server/storage';
import { logger } from '$lib/server/logger';
import { FALLBACK_ALLOWED_MIMES, FALLBACK_ALLOWED_EXTENSIONS } from '$lib/constants/pinRule';

/**
 * POST /api/v2/upload/presigned-url
 * Generate a presigned URL for file upload to cloud storage
 *
 * Body:
 * - fileName: string (required) - Name of file to upload
 * - contentType: string (optional) - MIME type (will be inferred if missing)
 * - expiresSeconds: number (optional, default: 600) - URL expiration time
 * - prefix: string (optional) - GCS path prefix (e.g. "pinrule/123"). Object path becomes {prefix}/{uuid}.ext
 * - replaceInFolder: boolean (optional) - If true, delete any existing objects under prefix/ first (one file per folder)
 *
 * Returns:
 * - url: string - Presigned upload URL
 * - objectPath: string - Cloud storage object path
 * - expiresAt: string - Expiration timestamp
 */
export const POST = unifiedEndpoint(
  async ({ context, event }) => {
    const { fileName, contentType, expiresSeconds = 600, prefix, replaceInFolder } = await event.request.json();

    if (!fileName) {
      throw Object.assign(
        new Error('fileName is required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    const prefixStr = prefix && String(prefix).trim() ? String(prefix).replace(/^\/+|\/+$/g, '') : '';
    const isPinRuleFallback = prefixStr.startsWith('pinrule/');

    // TC-RDM-APR-0079: Validate file type for pin rule fallback (image/video only)
    if (isPinRuleFallback) {
      const ext = '.' + (fileName.split('.').pop()?.toLowerCase() || '');
      const mimeValid = contentType && FALLBACK_ALLOWED_MIMES.includes(contentType as any);
      const extValid = FALLBACK_ALLOWED_EXTENSIONS.includes(ext);
      if (!mimeValid && !extValid) {
        throw Object.assign(
          new Error('Only image and video files are allowed (JPEG, PNG, WebP, GIF, MP4, WebM)'),
          { status: 400, code: ErrorCodes.INVALID_INPUT }
        );
      }
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

    if (replaceInFolder && prefixStr) {
      await deleteFilesFromCloudStorageByPrefix(prefixStr);
      logger.info(`Cleared existing files under prefix: ${prefixStr}`);
    }

    const baseName = generateFilePath(mockFile);
    const objectPath = prefixStr ? `${prefixStr}/${baseName}` : baseName;

    logger.info(`Generating presigned URL for: ${objectPath} (${inferredContentType})`);

    const result = await generatePresignedUrl(objectPath, inferredContentType, expiresSeconds);

    return successResponse(result);
  },
  { permission: 'upload.create' }
);
