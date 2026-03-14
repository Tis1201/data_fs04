import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { generateDownloadUrl, getStorageConfig } from '$lib/server/storage';

/**
 * GET /api/v2/upload/download-url?objectPath=pinrule/{id}/...&filename=...
 * Returns a download URL for an object (e.g. pin rule fallback screen).
 * objectPath must start with "pinrule/" for security.
 * In R2 mode, returns proxy URL. In LOCAL mode, returns direct static URL.
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
      const origin = url.origin;
      const proxyParams = new URLSearchParams({ objectPath: normalized });
      if (filename) proxyParams.set('filename', filename);
      const proxyUrl = `${origin}/api/v2/upload/download-proxy?${proxyParams.toString()}`;
      return successResponse({
        downloadUrl: proxyUrl,
        expires: Math.floor(Date.now() / 1000) + 3600
      });
    }

    const result = await generateDownloadUrl(normalized, 3600, filename || undefined);
    return successResponse({
      downloadUrl: result.url,
      expires: result.expires
    });
  },
  { permission: 'upload.create' }
);
