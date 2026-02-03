import { logger } from '$lib/server/logger';
import { generateDownloadUrl, generateDownloadUrlGCloud, generateDownloadUrlLocalCloud, getStorageConfig } from './index';
import path from 'path';

/**
 * Parse a GCloud URL and extract bucket and objectPath
 * Supports:
 * - https://storage.googleapis.com/bucket-name/path/to/file
 * - http://storage.googleapis.com/bucket-name/path/to/file
 * - gs://bucket-name/path/to/file
 */
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
                logger.warn('[GCloudUrlUtils] Invalid gs:// URL format', { url: gcloudUrl });
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
                logger.warn('[GCloudUrlUtils] Invalid GCloud URL format - no path', { url: gcloudUrl });
                return null;
            }
            const bucket = pathParts[0];
            const objectPath = pathParts.slice(1).join('/');
            return { bucket, objectPath };
        }

        return null;
    } catch (error) {
        logger.error('[GCloudUrlUtils] Error parsing GCloud URL', {
            url: gcloudUrl,
            error: error instanceof Error ? error.message : String(error)
        });
        return null;
    }
}

/**
 * Check if a string is a GCloud URL
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
 * Convert a GCloud URL to a signed download URL
 * This is useful when devices need to download files from GCloud
 * 
 * @param gcloudUrl - The GCloud URL (https://storage.googleapis.com/... or gs://...)
 * @param expiresSeconds - Expiration time in seconds (default: 3600 = 1 hour)
 * @param filename - Optional filename for Content-Disposition header
 * @returns Signed download URL or null if conversion fails
 */
export async function convertGCloudUrlToSignedDownloadUrl(
    gcloudUrl: string,
    expiresSeconds: number = 3600,
    filename?: string
): Promise<{ downloadUrl: string; bucket: string; objectPath: string; expires: number } | null> {
    try {
        // Parse the GCloud URL
        const parsed = parseGCloudUrl(gcloudUrl);
        if (!parsed) {
            logger.error('[GCloudUrlUtils] Failed to parse GCloud URL', { url: gcloudUrl });
            return null;
        }

        const { bucket, objectPath } = parsed;

        // Get storage config
        const storageConfig = getStorageConfig();
        const storageBucket = bucket || storageConfig.bucket;

        if (!storageBucket) {
            throw new Error('GCloud bucket not configured');
        }

        // Extract filename from objectPath if not provided
        const fileName = filename || path.basename(objectPath);

        logger.info('[GCloudUrlUtils] Converting GCloud URL to signed download URL', {
            originalUrl: gcloudUrl,
            bucket: storageBucket,
            objectPath,
            fileName,
            mode: storageConfig.mode
        });

        // Generate signed download URL based on storage mode
        let downloadUrlResult;

        if (storageConfig.mode === 'LOCAL_CLOUD') {
            if (!storageConfig.targetServiceAccount) {
                throw new Error('GCLOUD_TARGET_SA is required for LOCAL_CLOUD mode');
            }
            downloadUrlResult = await generateDownloadUrlLocalCloud(
                storageBucket,
                objectPath,
                storageConfig.targetServiceAccount,
                expiresSeconds,
                fileName
            );
        } else if (storageConfig.mode === 'GCLOUD') {
            downloadUrlResult = await generateDownloadUrlGCloud(
                storageBucket,
                objectPath,
                expiresSeconds,
                fileName
            );
        } else {
            // For LOCAL mode, use the generic function
            downloadUrlResult = await generateDownloadUrl(
                objectPath,
                expiresSeconds,
                fileName
            );
        }

        logger.info('[GCloudUrlUtils] Successfully converted GCloud URL to signed download URL', {
            originalUrl: gcloudUrl,
            signedUrl: downloadUrlResult.url,
            objectPath: downloadUrlResult.objectPath,
            bucket: downloadUrlResult.bucket
        });

        return {
            downloadUrl: downloadUrlResult.url,
            bucket: downloadUrlResult.bucket,
            objectPath: downloadUrlResult.objectPath,
            expires: downloadUrlResult.expires
        };
    } catch (error) {
        logger.error('[GCloudUrlUtils] Failed to convert GCloud URL to signed download URL', {
            url: gcloudUrl,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return null;
    }
}

