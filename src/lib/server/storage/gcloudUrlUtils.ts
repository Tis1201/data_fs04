import { logger } from '$lib/server/logger';
import { generateDownloadUrl, generateDownloadUrlR2, getStorageConfig } from './index';
import path from 'path';

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
 */
export async function convertGCloudUrlToSignedDownloadUrl(
    pathOrUrl: string,
    expiresSeconds: number = 3600,
    filename?: string
): Promise<{ downloadUrl: string; bucket: string; objectPath: string; expires: number } | null> {
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
            originalPath: pathOrUrl,
            bucket,
            objectPath,
            mode: storageConfig.mode
        });

        const downloadUrlResult = await generateDownloadUrlR2(bucket, objectPath, expiresSeconds, fileName);

        return {
            downloadUrl: downloadUrlResult.url,
            bucket: downloadUrlResult.bucket,
            objectPath: downloadUrlResult.objectPath,
            expires: downloadUrlResult.expires
        };
    } catch (error) {
        logger.error('[StorageUrlUtils] Failed to convert to signed download URL', {
            pathOrUrl,
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}
