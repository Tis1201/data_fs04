/**
 * GET /api/v2/upload/download-proxy?objectPath=pinrule/{id}/...&filename=...
 * Proxy download for pin rule fallback screens in R2 mode.
 * Validates objectPath under pinrule/, fetches from CDN with HMAC, streams to client.
 */
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { ErrorCodes } from '$lib/types/api';
import { generateHmacDownloadUrl } from '$lib/server/storage/gcloudUrlUtils';
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

    // Support both path-only (pinrule/123/x.jpg) and full URLs (extract path)
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

    const hmacResult = generateHmacDownloadUrl(normalized);
    if (!hmacResult) {
      throw Object.assign(
        new Error('HMAC not configured (CLOUDFLARE_R2_CDN_URL, CLOUDFLARE_R2_ACCESS_HMAC)'),
        { status: 500 }
      );
    }

    logger.info('[UploadDownloadProxy] Fetching from CDN', {
      objectPath: normalized,
      cdnUrl: hmacResult.downloadUrl.slice(0, 80) + '...'
    });

    const cdnRes = await fetch(hmacResult.downloadUrl, {
      method: 'GET',
      headers: { 'x-timestamp': hmacResult.timestamp, 'x-mac': hmacResult.mac }
    });

    if (!cdnRes.ok) {
      const errBody = await cdnRes.text();
      logger.error('[UploadDownloadProxy] CDN fetch failed', {
        objectPath: normalized,
        cdnStatus: cdnRes.status,
        bodyPreview: errBody.slice(0, 200)
      });
      const msg =
        cdnRes.status === 404
          ? 'File not found in storage (404). Check object exists at path in R2 bucket.'
          : `File not available (CDN returned ${cdnRes.status})`;
      throw Object.assign(new Error(msg), { status: cdnRes.status === 404 ? 404 : 502 });
    }

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
