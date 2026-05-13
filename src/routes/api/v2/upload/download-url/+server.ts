import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { getStorageConfig } from '$lib/server/storage';

/**
 * GET /api/v2/upload/download-url?objectPath=pinrule/{id}/...&filename=...
 * Returns a download URL for an object (e.g. pin rule fallback screen).
 * objectPath must start with "pinrule/" for security.
 * In R2 mode, returns CDN URL + HMAC for browser-direct (no proxy). In LOCAL mode, returns direct static URL.
 */
export const GET = unifiedEndpoint(
  async ({ event }) => {
    const url = new URL(event.request.url);
    const objectPath = url.searchParams.get('objectPath');
    const filename = url.searchParams.get('filename') || undefined;

    if (!objectPath || typeof objectPath !== 'string') {
      throw Object.assign(new Error('objectPath is required'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    const normalized = objectPath.replace(/^\/+|\/+$/g, '');
    if (!normalized.startsWith('pinrule/')) {
      throw Object.assign(new Error('objectPath must start with pinrule/'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    const storageConfig = getStorageConfig();

    if (storageConfig.mode === 'R2') {
      const { convertGCloudUrlToSignedDownloadUrl } = await import('$lib/server/storage');
      const result = await convertGCloudUrlToSignedDownloadUrl(normalized, 3600, filename);
      if (!result || !result.downloadAuth) {
        throw Object.assign(
          new Error('HMAC required for R2. Set CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC.'),
          { status: 500 }
        );
      }
      return successResponse({
        downloadUrl: result.downloadUrl,
        fileName: filename || normalized.split('/').pop(),
        expires: Math.floor(result.expires / 1000),
        downloadAuth: result.downloadAuth
      });
    }

    const { convertGCloudUrlToSignedDownloadUrl } = await import('$lib/server/storage');
    const result = await convertGCloudUrlToSignedDownloadUrl(normalized, 3600, filename);
    if (!result) {
      throw Object.assign(new Error('Failed to generate download URL'), { status: 500 });
    }
    return successResponse({
      downloadUrl: result.downloadUrl,
      fileName: filename || normalized.split('/').pop(),
      expires: Math.floor(result.expires / 1000),
      ...(result.downloadAuth && { downloadAuth: result.downloadAuth })
    });
  },
  { permission: 'upload.create' }
);
