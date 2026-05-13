/**
 * GET /api/v2/upload/download-proxy?objectPath=pinrule/{id}/...&filename=...
 * Proxy download for pin rule fallback screens in R2 mode.
 * Validates objectPath under pinrule/, fetches from CDN with HMAC, streams to client.
 */
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { fetchFromCdn } from '$lib/server/storage/gcloudUrlUtils';
import { getStorageConfig, parseCloudStorageUrl } from '$lib/server/storage';
import { logger } from '$lib/server/logger';

export const GET = unifiedEndpoint(
  async ({ event }) => {
    const url = new URL(event.request.url);
    const objectPathParam = url.searchParams.get('objectPath');
    const filename = url.searchParams.get('filename') || undefined;

    if (!objectPathParam || typeof objectPathParam !== 'string') {
      throw Object.assign(new Error('objectPath is required'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    let normalized = objectPathParam.replace(/^\/+|\/+$/g, '');
    const parsed = parseCloudStorageUrl(objectPathParam);
    if (parsed) {
      normalized = parsed.objectPath.replace(/^\/+|\/+$/g, '');
    }

    if (!normalized.startsWith('pinrule/')) {
      throw Object.assign(new Error('objectPath must start with pinrule/'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    if (normalized.includes('..')) {
      throw Object.assign(new Error('Invalid objectPath'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    const storageConfig = getStorageConfig();
    if (storageConfig.mode !== 'R2') {
      throw Object.assign(new Error('Download proxy only supports R2 mode'), { status: 500 });
    }

    logger.info('[UploadDownloadProxy] Fetching from CDN', { objectPath: normalized });

    const cdnRes = await fetchFromCdn(normalized, { label: 'UploadDownloadProxy' });

    const contentType = cdnRes.headers.get('Content-Type') || 'application/octet-stream';
    const safeName = (filename || normalized.split('/').pop() || 'fallback').replace(/"/g, '\\"');
    const disposition = `attachment; filename="${safeName}"`;

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': disposition
    };
    const contentLength = cdnRes.headers.get('Content-Length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    return new Response(cdnRes.body, { status: 200, headers: responseHeaders });
  },
  { permission: 'upload.create' }
);
