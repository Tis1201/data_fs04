import { createHmac } from 'crypto';
import { logger } from '$lib/server/logger';
import { getStorageConfig } from './index';
import path from 'path';

/** HMAC auth for device downloads via CDN. Device must send x-timestamp and x-mac headers. */
export interface DownloadAuthHmac {
    type: 'hmac';
    timestamp: string;
    mac: string;
}

export interface SignedDownloadResult {
    downloadUrl: string;
    bucket: string;
    objectPath: string;
    expires: number;
    downloadAuth?: DownloadAuthHmac;
}

/**
 * Generate HMAC-authenticated download URL for CDN.
 * When CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC are set, devices must use
 * this instead of presigned URLs. Device fetches with headers: x-timestamp, x-mac.
 */
export function generateHmacDownloadUrl(objectPath: string): { downloadUrl: string; timestamp: string; mac: string } | null {
    const cdnBase = process.env.CLOUDFLARE_R2_CDN_URL?.replace(/\/$/, '');
    const secret = process.env.CLOUDFLARE_R2_ACCESS_HMAC;
    if (!cdnBase || !secret) return null;

    const objectPathNorm = objectPath.startsWith('/') ? objectPath : `/${objectPath}`;

    // R2 direct URL (*.r2.cloudflarestorage.com) requires bucket in path: /{bucket}/{key}
    // Custom domain (e.g. cdn-dev.datarealities.com) maps directly to bucket root: /{key}
    const isR2Direct = cdnBase.includes('.r2.cloudflarestorage.com') || cdnBase.includes('.r2.dev');
    const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    const filePath = isR2Direct && bucket ? `/${bucket}${objectPathNorm}` : objectPathNorm;

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = filePath + timestamp;
    const mac = createHmac('sha256', secret).update(message).digest('base64');
    const downloadUrl = `${cdnBase}${filePath}`;

    return { downloadUrl, timestamp, mac };
}

/**
 * Fetch a file from the CDN with HMAC auth, retrying on transient Cloudflare edge 403s.
 * All server-side CDN proxy endpoints should use this instead of calling fetch() directly.
 */
export async function fetchFromCdn(
    objectPath: string,
    options?: { label?: string; maxRetries?: number }
): Promise<Response> {
    const label = options?.label ?? 'CdnFetch';
    const maxRetries = options?.maxRetries ?? 2;

    let hmacResult = generateHmacDownloadUrl(objectPath);
    if (!hmacResult) {
        throw Object.assign(
            new Error('HMAC not configured (CLOUDFLARE_R2_CDN_URL, CLOUDFLARE_R2_ACCESS_HMAC)'),
            { status: 500 }
        );
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
            const freshHmac = generateHmacDownloadUrl(objectPath);
            if (freshHmac) hmacResult = freshHmac;
            logger.warn(`[${label}] Retrying CDN fetch`, { attempt, objectPath, newTimestamp: hmacResult.timestamp });
        }

        const res = await fetch(hmacResult.downloadUrl, {
            method: 'GET',
            headers: {
                'x-timestamp': hmacResult.timestamp,
                'x-mac': hmacResult.mac,
                'User-Agent': 'FS04-WebProxy/1.0'
            }
        });

        if (res.ok) return res;

        const body = await res.text().catch(() => '');
        const isCloudflareBlock = res.status === 403 && body.includes('<!DOCTYPE html');

        if (!isCloudflareBlock || attempt === maxRetries) {
            logger.error(`[${label}] CDN fetch failed`, {
                status: res.status,
                attempt,
                url: hmacResult.downloadUrl,
                objectPath,
                responseBody: body.slice(0, 200)
            });
            const err = new Error(`CDN returned ${res.status}: ${body.slice(0, 100) || 'no body'}`) as Error & { status: number; cdnStatus: number };
            err.status = 502;
            err.cdnStatus = res.status;
            throw err;
        }

        logger.warn(`[${label}] Cloudflare edge 403, will retry`, { attempt, objectPath, responseBody: body.slice(0, 100) });
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }

    throw Object.assign(new Error('CDN fetch failed after retries'), { status: 502 });
}

/**
 * Extract filename with extension from resource path and name
 * Prioritizes extension from path over resource.name
 */
export function extractFilenameWithExtension(resourcePath: string, resourceName: string): string {
    // Extract extension from path
    const pathParts = resourcePath.split('/');
    const pathFileName = pathParts[pathParts.length - 1];
    
    // Remove query parameters if present
    const cleanPathFileName = pathFileName.split('?')[0];
    
    // Determine the file extension from path
    let fileExtension: string | undefined;
    if (cleanPathFileName && cleanPathFileName.includes('.')) {
        fileExtension = cleanPathFileName.split('.').pop();
    }
    
    // Build filename: use resource.name with extension appended if extension exists
    // Check if resource.name already ends with the extension (not just contains dots)
    if (fileExtension && resourceName) {
        const nameLower = resourceName.toLowerCase();
        const extLower = fileExtension.toLowerCase();
        const expectedExtension = `.${extLower}`;
        
        if (nameLower.endsWith(expectedExtension)) {
            // resource.name already ends with the correct extension, use it as-is
            return resourceName;
        } else {
            // resource.name doesn't have the extension, append it
            return `${resourceName}.${fileExtension}`;
        }
    } else if (cleanPathFileName && cleanPathFileName.includes('.')) {
        // Fallback: use filename from path if resource.name is not available
        return cleanPathFileName;
    }
    
    // Default: return resource.name as-is
    return resourceName;
}

export function parseGCloudUrl(gcloudUrl: string): { bucket: string; objectPath: string } | null {
    if (!gcloudUrl) {
        return null;
    }

    try {
        // Handle gs:// URLs
        if (gcloudUrl.startsWith('gs://')) {
            const gsPath = gcloudUrl.replace('gs://', '');
            const firstSlash = gsPath.indexOf('/');
            if (firstSlash === -1) {
                logger.warn('[StorageUrlUtils] Invalid gs:// URL format', { url: gcloudUrl });
                return null;
            }
            const bucket = gsPath.substring(0, firstSlash);
            const objectPath = gsPath.substring(firstSlash + 1);
            return { bucket, objectPath };
        }

        // Handle https:// or http:// URLs
        if (gcloudUrl.startsWith('https://storage.googleapis.com/') || 
            gcloudUrl.startsWith('http://storage.googleapis.com/')) {
            const url = new URL(gcloudUrl);
            const pathParts = url.pathname.split('/').filter(p => p);
            if (pathParts.length === 0) {
                logger.warn('[StorageUrlUtils] Invalid GCloud URL format - no path', { url: gcloudUrl });
                return null;
            }
            const bucket = pathParts[0];
            const objectPath = pathParts.slice(1).join('/');
            return { bucket, objectPath };
        }

        return null;
    } catch (error) {
        logger.error('[StorageUrlUtils] Error parsing GCloud URL', {
            url: gcloudUrl,
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}

/**
 * Check if a string is a GCloud URL (legacy)
 */
export function isGCloudUrl(url: string): boolean {
    if (!url) {
        return false;
    }
    return url.startsWith('https://storage.googleapis.com/') ||
           url.startsWith('http://storage.googleapis.com/') ||
           url.startsWith('gs://');
}

/**
 * Check if a string is an R2 or CDN URL
 */
export function isR2Url(url: string): boolean {
    if (!url) return false;
    return (
        url.includes('.r2.cloudflarestorage.com') ||
        url.includes('.r2.dev') ||
        (process.env.CLOUDFLARE_R2_CDN_URL && url.startsWith(process.env.CLOUDFLARE_R2_CDN_URL))
    );
}

/**
 * Parse an R2 or CDN URL to extract objectPath.
 * CDN URLs are typically https://cdn.example.com/objectPath (no bucket in path).
 */
export function parseR2Url(url: string): { bucket?: string; objectPath: string } | null {
    if (!url) return null;
    try {
        // CDN URL: https://cdn-dev.datarealities.com/resources/file.deb
        const cdnUrl = process.env.CLOUDFLARE_R2_CDN_URL?.replace(/\/$/, '');
        if (cdnUrl && url.startsWith(cdnUrl)) {
            const pathname = new URL(url).pathname;
            const objectPath = pathname.replace(/^\//, '');
            return { objectPath };
        }
        // R2 direct: https://xxx.r2.cloudflarestorage.com/bucket/key or similar
        if (url.includes('.r2.cloudflarestorage.com') || url.includes('.r2.dev')) {
            const u = new URL(url);
            const pathParts = u.pathname.split('/').filter(p => p);
            if (pathParts.length >= 2) {
                const bucket = pathParts[0];
                const objectPath = pathParts.slice(1).join('/');
                return { bucket, objectPath };
            }
            if (pathParts.length === 1) {
                return { objectPath: pathParts[0] };
            }
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Check if a string is any cloud storage URL (GCloud or R2)
 */
export function isCloudStorageUrl(url: string): boolean {
    return isGCloudUrl(url) || isR2Url(url);
}

/**
 * Parse any cloud storage URL (R2 or GCloud) to extract bucket and objectPath.
 * For path-only strings, returns null (caller should treat as objectPath with bucket from config).
 */
export function parseCloudStorageUrl(url: string): { bucket?: string; objectPath: string } | null {
    if (!url) return null;
    const r2 = parseR2Url(url);
    if (r2) return r2;
    const gcs = parseGCloudUrl(url);
    if (gcs) return gcs;
    return null;
}

/**
 * Convert a storage path or URL to a signed download URL.
 * Supports path-only (e.g. resources/file.deb), R2 URLs, and legacy GCloud URLs.
 * When in R2 mode, uses r2Bucket for path-only and parsed URLs.
 * When CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC are set, returns HMAC auth instead of presigned URL.
 */
export async function convertGCloudUrlToSignedDownloadUrl(
    pathOrUrl: string,
    expiresSeconds: number = 3600,
    filename?: string
): Promise<SignedDownloadResult | null> {
    try {
        const storageConfig = getStorageConfig();

        // LOCAL mode: path should be local file path - build static URL
        if (storageConfig.mode === 'LOCAL') {
            if (isCloudStorageUrl(pathOrUrl)) {
                logger.warn('[StorageUrlUtils] LOCAL mode with cloud URL - cannot serve', { pathOrUrl });
                return null;
            }
            const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
            const pathForUrl = pathOrUrl.startsWith('/') ? pathOrUrl
                : pathOrUrl.startsWith('uploads/') ? `/${pathOrUrl}` : `/uploads/iot/${pathOrUrl}`;
            return {
                downloadUrl: `${baseUrl.replace(/\/$/, '')}${pathForUrl}`,
                bucket: 'local',
                objectPath: pathOrUrl,
                expires: Date.now() + expiresSeconds * 1000
            };
        }

        // R2 mode: resolve objectPath and bucket from pathOrUrl
        let objectPath: string;
        let bucket: string;

        if (isR2Url(pathOrUrl)) {
            const parsed = parseR2Url(pathOrUrl);
            if (!parsed) {
                logger.error('[StorageUrlUtils] Failed to parse R2 URL', { url: pathOrUrl });
                return null;
            }
            objectPath = parsed.objectPath;
            bucket = parsed.bucket || storageConfig.r2Bucket;
        } else if (isGCloudUrl(pathOrUrl)) {
            const parsed = parseGCloudUrl(pathOrUrl);
            if (!parsed) {
                logger.error('[StorageUrlUtils] Failed to parse GCloud URL', { url: pathOrUrl });
                return null;
            }
            objectPath = parsed.objectPath;
            bucket = storageConfig.r2Bucket; // Use R2 bucket (assumes data migrated)
        } else {
            // Path-only (e.g. resources/file.deb)
            objectPath = pathOrUrl.replace(/^\/+|\/+$/g, '');
            bucket = storageConfig.r2Bucket;
        }

        if (!bucket || !objectPath) {
            throw new Error('Storage bucket not configured');
        }

        const fileName = filename || path.basename(objectPath);

        logger.info('[StorageUrlUtils] Converting to signed download URL', {
            objectPath,
            mode: storageConfig.mode
        });

        // R2 mode: HMAC only (no presigned URLs). CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC required.
        const hmacResult = generateHmacDownloadUrl(objectPath);
        if (!hmacResult) {
            logger.error('[StorageUrlUtils] HMAC not configured. Set CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC for R2 downloads.');
            return null;
        }
        return {
            downloadUrl: hmacResult.downloadUrl,
            bucket,
            objectPath,
            expires: Date.now() + expiresSeconds * 1000,
            downloadAuth: {
                type: 'hmac',
                timestamp: hmacResult.timestamp,
                mac: hmacResult.mac
            }
        };
    } catch (error) {
        logger.error('[StorageUrlUtils] Failed to convert to signed download URL', {
            pathOrUrl,
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}
