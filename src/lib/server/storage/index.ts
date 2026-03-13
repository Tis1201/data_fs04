import { logger } from '$lib/server/logger';
import { join, basename } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getR2Client } from './r2Client';
import { PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type StorageMode = 'LOCAL' | 'R2';

/** GCS folder for resource uploads during add-flow (before user confirms). Moved to RESOURCES_FOLDER on create. */
export const RESOURCES_TEMP_PREFIX = 'temp/resources';
/** GCS folder where all resource files are stored after "Add" is confirmed. */
export const RESOURCES_FOLDER = 'resources';

export interface StorageConfig {
    mode: StorageMode;
    r2Bucket: string;
    r2CdnUrl?: string;
}

export interface UploadResult {
    url: string;
    path: string;
    bucket?: string;
}

export interface PresignedUrlResult {
    url: string;
    bucket: string;
    objectPath: string;
    contentType: string;
    expires: number;
}

export interface FileMetadata {
    name: string;
    size: number;
    contentType?: string;
}

/**
 * Get storage configuration from environment variables
 */
export function getStorageConfig(): StorageConfig {
    const storageMode = (process.env.STORAGE as StorageMode) || 'LOCAL';
    
    // For local mode without a specific R2 bucket configured, we provide a dummy
    let r2Bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
    if (storageMode === 'R2' && !r2Bucket) {
        throw new Error('CLOUDFLARE_R2_BUCKET_NAME environment variable is required for R2 mode');
    }

    const r2CdnUrl = process.env.CLOUDFLARE_R2_CDN_URL?.replace(/\/$/, '');

    return {
        mode: storageMode,
        r2Bucket,
        r2CdnUrl
    };
}

/**
 * Generate a unique file path with proper extension
 */
export function generateFilePath(file: File): string {
    const uniqueId = uuidv4();
    
    // Determine file extension
    let fileExt = '';
    if (file.name && file.name.includes('.')) {
        fileExt = file.name.split('.').pop() || '';
    } else if (file.type) {
        // Basic MIME type to extension mapping
        const mimeExtMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'video/mp4': 'mp4',
            'video/webm': 'webm',
            'application/pdf': 'pdf',
            'text/plain': 'txt',
            'application/json': 'json'
        };
        fileExt = mimeExtMap[file.type] || '';
    }

    return fileExt ? `${uniqueId}.${fileExt}` : uniqueId;
}

/**
 * Save file locally (for LOCAL mode)
 */
export async function saveFileLocally(file: File, filePath: string): Promise<string> {
    const UPLOAD_DIR = join(process.cwd(), 'static', 'uploads', 'iot');
    
    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
        try {
            mkdirSync(UPLOAD_DIR, { recursive: true });
            logger.info(`Created upload directory: ${UPLOAD_DIR}`);
        } catch (err) {
            logger.error(`Failed to create upload directory: ${err}`);
            throw new Error('Failed to create upload directory');
        }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
        throw new Error('Uploaded file is empty (0 bytes)');
    }

    const localPath = join(UPLOAD_DIR, filePath);
    writeFileSync(localPath, buffer);
    logger.debug(`Saved file locally: ${localPath} (size=${buffer.length})`);
    
    return `/uploads/iot/${filePath}`;
}

	// GCloud legacy generator removed!

/**
 * Generate presigned URL for R2 mode
 */
export async function generatePresignedUrlR2(
    bucket: string,
    objectPath: string,
    contentType: string,
    expiresSeconds: number = 600
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);
        const r2Client = getR2Client();
        
        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: objectPath,
            ContentType: contentType || 'application/octet-stream',
        });

        const url = await getSignedUrl(r2Client, command, { expiresIn: expiresSeconds });

        logger.info(`Generated presigned URL for R2: bucket=${bucket}, objectPath=${objectPath}`);

        return {
            url,
            bucket,
            objectPath,
            contentType,
            expires
        };
    } catch (error) {
        logger.error(`Failed to generate presigned URL for R2: ${error}`);
        throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Upload file contents to a presigned URL (PUT with uploadType=media).
 * Used so the server actually writes the file to GCS when in LOCAL_CLOUD/GCLOUD mode.
 */
async function uploadFileToPresignedUrl(
    file: File,
    uploadUrl: string,
    contentType: string
): Promise<void> {
    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);
    if (body.length === 0) {
        throw new Error('Uploaded file is empty (0 bytes)');
    }
    const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType || 'application/octet-stream'
        },
        body
    });
    if (!res.ok) {
        const text = await res.text();
        logger.error(`GCS upload failed: ${res.status} ${res.statusText}`, { body: text.slice(0, 500) });
        throw new Error(`Failed to upload file to GCS: ${res.status} ${res.statusText}`);
    }
    logger.info(`Uploaded file to GCS: ${file.name || 'unknown'} (${body.length} bytes)`);
}

/**
 * Main function to handle file upload based on storage configuration
 */
export async function handleFileUpload(file: File): Promise<UploadResult> {
    const config = getStorageConfig();
    const filePath = generateFilePath(file);

    logger.info(`Handling file upload with storage mode: ${config.mode}`);

    switch (config.mode) {
        case 'LOCAL':
            const localUrl = await saveFileLocally(file, filePath);
            return {
                url: localUrl,
                path: filePath
            };

        case 'R2':
            const presignedUrlR2 = await generatePresignedUrlR2(
                config.r2Bucket,
                filePath,
                file.type
            );
            await uploadFileToPresignedUrl(file, presignedUrlR2.url, presignedUrlR2.contentType);
            
            const r2CdnUrl = config.r2CdnUrl;
            let stableUrlR2: string;
            
            if (r2CdnUrl) {
                stableUrlR2 = `${r2CdnUrl}/${filePath}`;
            } else {
                const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || '';
                stableUrlR2 = `${endpoint}/${config.r2Bucket}/${filePath}`;
            }
            
            return {
                url: stableUrlR2,
                path: filePath,
                bucket: config.r2Bucket
            };

        default:
            throw new Error(`Unsupported storage mode: ${config.mode}`);
    }
}

/**
 * Generate presigned URL for direct upload (used by frontend)
 */
export async function generatePresignedUrl(
    objectPath: string,
    contentType: string,
    expiresSeconds: number = 600
): Promise<PresignedUrlResult> {
    const config = getStorageConfig();

    logger.info(`[PresignedURL] Starting presigned URL generation for mode: ${config.mode}`);

    // Bucket requirement is checked per mode below

    switch (config.mode) {
        case 'LOCAL':
            // For LOCAL mode, we'll create a local API endpoint for upload
            const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';
            const url = `${baseUrl}/api/upload/local?path=${encodeURIComponent(objectPath)}&contentType=${encodeURIComponent(contentType)}`;
            
            logger.info(`Generated LOCAL presigned URL: ${url}`);
            
            return {
                url,
                bucket: 'local',
                objectPath,
                contentType,
                expires: Date.now() + (expiresSeconds * 1000)
            };


        case 'R2':
            if (!config.r2Bucket) {
                throw new Error('CLOUDFLARE_R2_BUCKET_NAME environment variable is required for R2 mode');
            }
            return await generatePresignedUrlR2(
                config.r2Bucket,
                objectPath,
                contentType,
                expiresSeconds
            );

        default:
            throw new Error(`Presigned URL generation not supported for storage mode: ${config.mode}`);
    }
}

/**
 * Generate presigned URL for download (used for serving files)
 */
export async function generateDownloadUrl(
    objectPath: string,
    expiresSeconds: number = 3600,
    filename?: string
): Promise<PresignedUrlResult> {
    const config = getStorageConfig();

    switch (config.mode) {
        case 'R2':
            if (!config.r2Bucket) {
                throw new Error('CLOUDFLARE_R2_BUCKET_NAME environment variable is required for R2 mode protocol details');
            }
            return await generateDownloadUrlR2(
                config.r2Bucket,
                objectPath,
                expiresSeconds,
                filename
            );

        default:
            throw new Error(`Download URL generation not supported for storage mode: ${config.mode}`);
    }
}

/**
 * Download a file from R2 to a local path.
 */
export async function downloadR2FileToPath(
    bucket: string,
    objectPath: string,
    destinationPath: string
): Promise<void> {
    const r2Client = getR2Client();
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: objectPath
    });
    
    const response = await r2Client.send(command);
    if (!response.Body) {
        throw new Error(`R2 download failed: Empty body for ${objectPath}`);
    }
    
    const { pipeline } = await import('stream/promises');
    const { createWriteStream } = await import('fs');
    await pipeline(response.Body as any, createWriteStream(destinationPath));
    logger.info(`[downloadR2FileToPath] Downloaded from R2 to ${destinationPath}`);
}

/**
 * Download a file from cloud storage to a local path.
 * In R2 mode, it dispatches to the R2 client.
 */
export async function downloadCloudFileToPath(
    bucket: string,
    objectPath: string,
    destinationPath: string,
    options: { targetServiceAccount?: string } = {}
): Promise<void> {
    const config = getStorageConfig();

    if (config.mode === 'R2') {
        const r2Bucket = bucket || config.r2Bucket;
        if (!r2Bucket) throw new Error('R2 bucket not provided and not in config');
        return await downloadR2FileToPath(r2Bucket, objectPath, destinationPath);
    }

    throw new Error('Cloud storage download only supported in R2 mode');
}

/**
 * Copy an object in R2.
 */
async function copyR2Object(
    sourceBucket: string,
    sourcePath: string,
    destBucket: string,
    destPath: string
): Promise<void> {
    const r2Client = getR2Client();
    const command = new CopyObjectCommand({
        Bucket: destBucket,
        // S3 requires CopySource to be URL-encoded, and usually /bucket/key
        CopySource: encodeURI(`${sourceBucket}/${sourcePath}`),
        Key: destPath
    });
    await r2Client.send(command);
    logger.info(`[copyR2Object] Copied ${sourceBucket}/${sourcePath} to ${destBucket}/${destPath}`);
}

/**
 * Move object in cloud storage (copy then delete source). Used when moving resource from temp/resources to resources.
 */
export async function moveCloudObject(
    bucket: string,
    sourcePath: string,
    destPath: string,
    options: { targetServiceAccount?: string } = {}
): Promise<void> {
    const config = getStorageConfig();
    
    if (config.mode === 'R2') {
        const r2Bucket = bucket || config.r2Bucket;
        if (!r2Bucket) throw new Error('R2 bucket not configured');
        await copyR2Object(r2Bucket, sourcePath, r2Bucket, destPath);
        await deleteFileFromR2(r2Bucket, sourcePath);
        logger.info(`[moveCloudObject] Moved ${sourcePath} -> ${destPath} in R2`);
        return;
    }

    throw new Error('Cloud storage move only supported in R2 mode');
}

/**
 * Ensure the object path is under the resources folder. If it is under temp/resources or at bucket root,
 * move it to resources/{filename} and return the new object path. Otherwise return as-is.
 */
export async function ensureResourceInResourcesFolder(
    bucket: string,
    objectPath: string
): Promise<string> {
    const normalized = objectPath.replace(/^\/+|\/+$/g, '');
    const filename = normalized.split('/').pop() || normalized;
    const resourcesPath = `${RESOURCES_FOLDER}/${filename}`;

    if (normalized === resourcesPath || normalized.startsWith(`${RESOURCES_FOLDER}/`)) {
        return normalized;
    }

    const config = getStorageConfig();
    await moveCloudObject(bucket, normalized, resourcesPath);
    return resourcesPath;
}

// GCloud logic legacy removed!

/**
 * Generate download URL for R2 mode
 */
export async function generateDownloadUrlR2(
    bucket: string,
    objectPath: string,
    expiresSeconds: number = 3600,
    filename?: string
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);
        const r2Client = getR2Client();
        
        const responseDisposition = filename 
            ? `attachment; filename="${filename}"`
            : 'attachment';
            
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: objectPath,
            ResponseContentDisposition: responseDisposition
        });

        const url = await getSignedUrl(r2Client, command, { expiresIn: expiresSeconds });
        
        logger.debug(`Generated download URL for R2: ${url.substring(0, 50)}...`);

        return {
            url,
            bucket,
            objectPath,
            contentType: 'application/octet-stream',
            expires
        };
    } catch (error) {
        logger.error(`Failed to generate download URL for R2: ${error}`);
        throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Delete file from cloud storage
 */
// Export GCloud URL utilities
export {
    parseGCloudUrl,
    isGCloudUrl,
    isR2Url,
    isCloudStorageUrl,
    parseR2Url,
    parseCloudStorageUrl,
    convertGCloudUrlToSignedDownloadUrl
} from './gcloudUrlUtils';

export async function deleteFileFromR2(
    bucket: string,
    objectPath: string
): Promise<void> {
    try {
        const r2Client = getR2Client();
        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: objectPath
        });
        await r2Client.send(command);
        logger.info(`Successfully deleted file from R2: ${objectPath}`);
    } catch (error) {
        logger.error(`Failed to delete file from R2: ${error}`);
        throw new Error(`Failed to delete file from R2: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function deleteFileFromCloudStorage(filePath: string): Promise<void> {
    const config = getStorageConfig();
    
    if (config.mode === 'R2') {
        const bucket = config.r2Bucket;
        if (!bucket) {
            logger.warn('No R2 bucket configured for cloud storage deletion');
            return;
        }
        let objectPath = filePath;
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            try {
                objectPath = new URL(filePath).pathname.substring(1);
                // Strip bucket name from path if needed (for non-CDN URLs)
                if (objectPath.startsWith(`${bucket}/`)) {
                    objectPath = objectPath.substring(bucket.length + 1);
                }
            } catch (e) {
               // fallback to raw
            }
        }
        try {
            await deleteFileFromR2(bucket, objectPath);
        } catch (error) {
            // Already logged in deleteFileFromR2
        }
        return;
    }

    if (config.mode === 'LOCAL') {
        // For local mode, delete from local filesystem
        const { unlinkSync } = await import('fs');
        const { join } = await import('path');
        
        // Extract filename from path
        let localPath = filePath;
        if (filePath.startsWith('/uploads/')) {
            localPath = join(process.cwd(), 'static', filePath.substring(1));
        } else if (filePath.startsWith('uploads/')) {
            localPath = join(process.cwd(), 'static', filePath);
        } else {
            localPath = join(process.cwd(), 'static', 'uploads', 'iot', filePath);
        }
        
        try {
            unlinkSync(localPath);
            logger.info(`Deleted local file: ${localPath}`);
        } catch (err) {
            logger.warn(`Failed to delete local file ${localPath}: ${err}`);
        }
    }
}

/**
 * List object paths under a prefix in cloud storage (for replace-in-folder behavior).
 */
export async function listObjectsByPrefix(prefix: string): Promise<string[]> {
    const config = getStorageConfig();
    if (config.mode === 'LOCAL') {
        const { readdirSync } = await import('fs');
        const pathPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
        const dir = join(process.cwd(), 'static', 'uploads', 'iot', pathPrefix);
        try {
            const names = (await import('fs')).readdirSync(dir, { withFileTypes: true })
                .filter((e: any) => e.isFile())
                .map((e: any) => `${pathPrefix}${e.name}`);
            return names;
        } catch {
            return [];
        }
    }
    if (config.mode === 'R2' && config.r2Bucket) {
        try {
            const r2Client = getR2Client();
            const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
            const command = new ListObjectsV2Command({
                Bucket: config.r2Bucket,
                Prefix: normalizedPrefix
            });
            const response = await r2Client.send(command);
            return (response.Contents || []).map((c) => c.Key || '').filter(Boolean);
        } catch (err) {
            logger.warn(`listObjectsByPrefix R2 failed: ${err}`);
        }
    }
    return [];
}

/**
 * Delete all objects under a prefix.
 */
export async function deleteFilesFromCloudStorageByPrefix(prefix: string): Promise<void> {
    const names = await listObjectsByPrefix(prefix);
    const config = getStorageConfig();
    const bucket = config.mode === 'R2' ? config.r2Bucket : null;
    for (const objectPath of names) {
        try {
            if (config.mode === 'R2' && bucket) {
                await deleteFileFromR2(bucket, objectPath);
            } else if (config.mode === 'LOCAL') {
                const { unlinkSync } = await import('fs');
                const localPath = join(process.cwd(), 'static', 'uploads', 'iot', objectPath);
                try {
                    unlinkSync(localPath);
                } catch {}
            }
        } catch (e) {
            logger.warn(`Failed to delete ${objectPath}: ${e}`);
        }
    }
}

/**
 * Get file metadata (name and size) from Cloud Storage URL
 * Returns null if file is not in Cloud Storage or if metadata cannot be retrieved
 */
export async function getFileMetadataFromCloudUrl(cloudUrl: string): Promise<FileMetadata | null> {
    try {
        const config = getStorageConfig();
        if (config.mode === 'LOCAL') {
            logger.debug(`Storage mode is LOCAL, cannot get cloud metadata`);
            return null;
        }

        if (config.mode === 'R2') {
            try {
                const r2Bucket = config.r2Bucket;
                if (!r2Bucket) return null;
                
                let objectPath = '';
                try {
                    objectPath = new URL(cloudUrl).pathname.substring(1);
                    if (objectPath.startsWith(`${r2Bucket}/`)) {
                        objectPath = objectPath.substring(r2Bucket.length + 1);
                    }
                } catch (e) {
                    objectPath = cloudUrl; // assume it's directly an object path
                }

                const r2Client = getR2Client();
                const command = new HeadObjectCommand({ Bucket: r2Bucket, Key: objectPath });
                const response = await r2Client.send(command);
                
                return {
                    name: basename(objectPath),
                    size: response.ContentLength || 0,
                    contentType: response.ContentType
                };
            } catch (error) {
                logger.warn(`Failed to get metadata from R2: ${error}`);
                return null;
            }
        }

        return null;
    } catch (error) {
        logger.error(`Failed to get file metadata from GCS URL: ${error}`);
        // Return null instead of throwing to allow the operation to continue without metadata
        return null;
    }
}
