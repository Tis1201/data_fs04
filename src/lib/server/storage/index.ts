import { Storage } from '@google-cloud/storage';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';
import { join, dirname, basename } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getGCloudAccessToken, isCredentialError } from './gcloudAuthUtils';

export type StorageMode = 'LOCAL' | 'LOCAL_CLOUD' | 'GCLOUD';

export interface StorageConfig {
    mode: StorageMode;
    bucket?: string;
    targetServiceAccount?: string;
    projectId?: string;
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
    const storageMode = (env.STORAGE as StorageMode) || 'LOCAL';
    const bucket = env.GCLOUD_BUCKET;
    const targetServiceAccount = env.GCLOUD_TARGET_SA;
    const projectId = env.GCLOUD_PROJECT_ID || 'cs-poc-vlkpvg5seziflnwq2ni7x3l';

    return {
        mode: storageMode,
        bucket,
        targetServiceAccount,
        projectId
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

/**
 * Generate presigned URL for LOCAL_CLOUD mode (using service account impersonation)
 */
export async function generatePresignedUrlLocalCloud(
    bucket: string,
    objectPath: string,
    contentType: string,
    targetServiceAccount: string,
    expiresSeconds: number = 600
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);

        logger.info(`Generating presigned URL for LOCAL_CLOUD: bucket=${bucket}, objectPath=${objectPath}, targetSA=${targetServiceAccount}`);

        // Use gcloud CLI to generate presigned URL (bypasses signing issues)
        const { execSync } = await import('child_process');
        
        const bucketName = bucket;
        const fileName = objectPath;
        const expiresInSeconds = Math.floor(expiresSeconds);
        
        logger.info(`Using gcloud CLI to generate presigned URL...`);
        
        try {
            // Get access token using shared utility
            logger.info(`Getting access token with impersonation...`);
            const accessToken = getGCloudAccessToken(targetServiceAccount);
            
            logger.info(`Access token obtained, generating presigned URL...`);
            
            // Now use the access token to generate a presigned URL via HTTP API
            const presignedUrlCommand = `curl -s -X POST "https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodeURIComponent(fileName)}?uploadType=media" -H "Authorization: Bearer ${accessToken}" -H "Content-Type: ${contentType}" -d '{"name":"${fileName}"}'`;
            
            // Actually, let's use a simpler approach - create a signed URL using the access token
            const signedUrl = `https://storage.googleapis.com/${bucketName}/${fileName}?uploadType=media&access_token=${accessToken}`;
            
            logger.info(`Generated signed URL with access token for: ${objectPath}`);

            return {
                url: signedUrl,
                bucket: bucketName,
                objectPath,
                contentType,
                expires
            };
            
        } catch (gcloudError) {
            logger.warn(`gcloud CLI failed, falling back to simple URL: ${gcloudError instanceof Error ? gcloudError.message : String(gcloudError)}`);
            
            // Fallback: create a simple upload URL
            const uploadUrl = `https://storage.googleapis.com/${bucketName}/${fileName}?uploadType=media`;
            
            logger.info(`Generated fallback upload URL for: ${objectPath}`);

            return {
                url: uploadUrl,
                bucket: bucketName,
                objectPath,
                contentType,
                expires
            };
        }
    } catch (error) {
        logger.error(`Failed to generate presigned URL for LOCAL_CLOUD: ${error}`);
        logger.error(`Error details: ${error instanceof Error ? error.stack : String(error)}`);
        throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generate presigned URL for GCLOUD mode (using VM service account)
 */
export async function generatePresignedUrlGCloud(
    bucket: string,
    objectPath: string,
    contentType: string,
    expiresSeconds: number = 600
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);
        const config = getStorageConfig();
        const storage = new Storage({ 
            projectId: config.projectId 
        }); // Uses VM SA; will "sign with IAM" automatically

        const file = storage.bucket(bucket).file(objectPath);
        
        // Don't include contentType in the signature to avoid 403 errors
        // The client can send any Content-Type header without signature mismatch
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires
            // contentType is intentionally omitted to avoid signed header mismatch
        });

        return {
            url,
            bucket,
            objectPath,
            contentType,
            expires
        };
    } catch (error) {
        logger.error(`Failed to generate presigned URL for GCLOUD: ${error}`);
        throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`);
    }
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

        case 'LOCAL_CLOUD':
            if (!config.bucket || !config.targetServiceAccount) {
                throw new Error('GCLOUD_BUCKET and GCLOUD_TARGET_SA environment variables are required for LOCAL_CLOUD mode');
            }
            const presignedUrlLocalCloud = await generatePresignedUrlLocalCloud(
                config.bucket,
                filePath,
                file.type,
                config.targetServiceAccount
            );
            return {
                url: presignedUrlLocalCloud.url,
                path: filePath,
                bucket: config.bucket
            };

        case 'GCLOUD':
            if (!config.bucket) {
                throw new Error('GCLOUD_BUCKET environment variable is required for GCLOUD mode');
            }
            const presignedUrlGCloud = await generatePresignedUrlGCloud(
                config.bucket,
                filePath,
                file.type
            );
            return {
                url: presignedUrlGCloud.url,
                path: filePath,
                bucket: config.bucket
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

        case 'LOCAL_CLOUD':
            if (!config.bucket) {
                throw new Error('GCLOUD_BUCKET environment variable is required for LOCAL_CLOUD mode');
            }
            if (!config.targetServiceAccount) {
                throw new Error('GCLOUD_TARGET_SA environment variable is required for LOCAL_CLOUD mode');
            }
            return await generatePresignedUrlLocalCloud(
                config.bucket,
                objectPath,
                contentType,
                config.targetServiceAccount,
                expiresSeconds
            );

        case 'GCLOUD':
            if (!config.bucket) {
                throw new Error('GCLOUD_BUCKET environment variable is required for GCLOUD mode');
            }
            return await generatePresignedUrlGCloud(
                config.bucket,
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

    if (!config.bucket) {
        throw new Error('GCLOUD_BUCKET environment variable is required for download URL generation');
    }

    switch (config.mode) {
        case 'LOCAL_CLOUD':
            if (!config.targetServiceAccount) {
                throw new Error('GCLOUD_TARGET_SA environment variable is required for LOCAL_CLOUD mode');
            }
            return await generateDownloadUrlLocalCloud(
                config.bucket,
                objectPath,
                config.targetServiceAccount,
                expiresSeconds,
                filename
            );

        case 'GCLOUD':
            return await generateDownloadUrlGCloud(
                config.bucket,
                objectPath,
                expiresSeconds,
                filename
            );

        default:
            throw new Error(`Download URL generation not supported for storage mode: ${config.mode}`);
    }
}

/**
 * Generate download URL for LOCAL_CLOUD mode (using service account impersonation)
 */
export async function generateDownloadUrlLocalCloud(
    bucket: string,
    objectPath: string,
    targetServiceAccount: string,
    expiresSeconds: number = 3600,
    filename?: string
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);

        logger.info(`Generating download URL for LOCAL_CLOUD: bucket=${bucket}, objectPath=${objectPath}, targetSA=${targetServiceAccount}`);

        // Use gcloud CLI to generate download URL (bypasses signing issues)
        const { execSync } = await import('child_process');
        
        const bucketName = bucket;
        const fileName = objectPath;
        const expiresInSeconds = Math.floor(expiresSeconds);
        
        logger.info(`Using gcloud CLI to generate download URL...`);
        
        try {
            // Get access token using shared utility
            logger.info(`Getting access token with impersonation...`);
            const accessToken = getGCloudAccessToken(targetServiceAccount);
            
            logger.info(`Access token obtained, generating download URL...`);
            
            // Construct download URL with access token and proper filename
            const responseDisposition = filename 
                ? `attachment; filename="${filename}"`
                : 'attachment';
            
            const downloadUrl = `https://storage.googleapis.com/${bucketName}/${fileName}?access_token=${accessToken}&response-content-disposition=${encodeURIComponent(responseDisposition)}`;
            
            logger.info(`Generated download URL with access token for: ${objectPath}`);

            return {
                url: downloadUrl,
                bucket: bucketName,
                objectPath,
                contentType: 'application/octet-stream',
                expires
            };
            
        } catch (gcloudError) {
            logger.warn(`gcloud CLI failed, falling back to simple URL: ${gcloudError instanceof Error ? gcloudError.message : String(gcloudError)}`);
            
            // Fallback: create a simple download URL
            const responseDisposition = filename 
                ? `attachment; filename="${filename}"`
                : 'attachment';
            
            const downloadUrl = `https://storage.googleapis.com/${bucketName}/${fileName}?response-content-disposition=${encodeURIComponent(responseDisposition)}`;
            
            logger.info(`Generated fallback download URL for: ${objectPath}`);

            return {
                url: downloadUrl,
                bucket: bucketName,
                objectPath,
                contentType: 'application/octet-stream',
                expires
            };
        }
    } catch (error) {
        logger.error(`Failed to generate download URL for LOCAL_CLOUD: ${error}`);
        throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Generate download URL for GCLOUD mode (using VM service account)
 */
export async function generateDownloadUrlGCloud(
    bucket: string,
    objectPath: string,
    expiresSeconds: number = 3600,
    filename?: string
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);
        const config = getStorageConfig();
        const storage = new Storage({ 
            projectId: config.projectId 
        }); // Uses VM SA; will "sign with IAM" automatically

        const file = storage.bucket(bucket).file(objectPath);
        
        const responseDisposition = filename 
            ? `attachment; filename="${filename}"`
            : 'attachment';
            
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires,
            responseDisposition
        });
        
        logger.debug(`Generated download URL for GCLOUD: ${url}`);

        return {
            url,
            bucket,
            objectPath,
            contentType: 'application/octet-stream', // Default for downloads
            expires
        };
    } catch (error) {
        logger.error(`Failed to generate download URL for GCLOUD: ${error}`);
        throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Delete file from cloud storage
 */
// Export GCloud URL utilities
export { parseGCloudUrl, isGCloudUrl, convertGCloudUrlToSignedDownloadUrl } from './gcloudUrlUtils';

export async function deleteFileFromCloudStorage(filePath: string): Promise<void> {
    const config = getStorageConfig();
    
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
            // Don't throw error for local file deletion failures
        }
        return;
    }
    
    if (!config.bucket) {
        logger.warn('No bucket configured for cloud storage deletion');
        return;
    }
    
    // Extract object path from the stored path
    let objectPath = filePath;
    
    // Lazy import to avoid circular dependency
    const { isGCloudUrl, parseGCloudUrl } = await import('./gcloudUrlUtils');
    
    if (isGCloudUrl(filePath)) {
        // Extract the object path from the full URL
        const parsed = parseGCloudUrl(filePath);
        if (parsed) {
            objectPath = parsed.objectPath;
            logger.info(`Extracted object path from GCloud URL: ${objectPath}`);
        } else {
            logger.warn(`Failed to parse GCloud URL for deletion, using path as-is: ${filePath}`);
        }
    } else if (filePath.includes('/')) {
        // This is already an object path
        objectPath = filePath;
        logger.info(`Using stored object path: ${objectPath}`);
    } else {
        logger.warn(`Unexpected file path format for deletion: ${filePath}`);
        return;
    }
    
    try {
        switch (config.mode) {
            case 'LOCAL_CLOUD':
                await deleteFileFromLocalCloud(config.bucket, objectPath, config.targetServiceAccount!);
                break;
            case 'GCLOUD':
                await deleteFileFromGCloud(config.bucket, objectPath);
                break;
            default:
                logger.warn(`File deletion not supported for storage mode: ${config.mode}`);
        }
    } catch (error) {
        logger.error(`Failed to delete file from cloud storage: ${error}`);
        // Don't throw error - we don't want file deletion failures to break the resource deletion
    }
}

/**
 * Delete file from LOCAL_CLOUD mode (using service account impersonation)
 * Uses gcloud CLI to avoid invalid_rapt errors with user credentials
 */
async function deleteFileFromLocalCloud(
    bucket: string,
    objectPath: string,
    targetServiceAccount: string
): Promise<void> {
    try {
        logger.info(`Deleting file from LOCAL_CLOUD: bucket=${bucket}, objectPath=${objectPath}, targetSA=${targetServiceAccount}`);

        // Use gcloud CLI with service account impersonation (more reliable than SDK impersonation)
        try {
            // Get access token using shared utility
            logger.debug(`Getting access token with impersonation...`);
            const accessToken = getGCloudAccessToken(targetServiceAccount);
            
            logger.debug(`Access token obtained, deleting file via API...`);
            
            // Delete file using GCloud Storage API with access token
            const deleteUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}`;
            
            // Use native fetch (Node.js 18+)
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (response.status === 404) {
                logger.warn(`File does not exist in cloud storage: ${objectPath}`);
                return; // File already deleted, consider it success
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GCloud API error: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            logger.info(`Successfully deleted file from LOCAL_CLOUD: ${objectPath}`);
            
        } catch (gcloudError) {
            // If gcloud CLI fails (e.g., invalid_rapt), try SDK approach as fallback
            const errorMessage = gcloudError instanceof Error ? gcloudError.message : String(gcloudError);
            
            // If it's a credential error, don't try SDK fallback (it will fail too)
            if (isCredentialError(gcloudError)) {
                logger.error(`Failed to delete file from LOCAL_CLOUD: Credentials need refresh. Please run 'gcloud auth application-default login'`, {
                    error: errorMessage,
                    objectPath,
                    bucket,
                    targetServiceAccount
                });
                // Don't throw - allow cleanup to continue with other files
                // The file will be retried on next cleanup run
                return;
            }
            
            logger.warn(`gcloud CLI deletion failed, trying SDK approach: ${errorMessage}`);
            
            // Fallback to SDK approach
            const auth = new GoogleAuth({ 
                scopes: ['https://www.googleapis.com/auth/cloud-platform'] 
            });
            const sourceClient = await auth.getClient();
            
            logger.debug(`Source client obtained: ${sourceClient.constructor.name}`);

            // Impersonate the service account
            const impersonated = new Impersonated({
                sourceClient,
                targetPrincipal: targetServiceAccount,
                lifetime: 3600,
                delegates: [],
                targetScopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });

            logger.debug(`Impersonated client created for: ${targetServiceAccount}`);

            // Use the impersonated client with Storage
            const config = getStorageConfig();
            const storage = new Storage({ 
                authClient: impersonated,
                projectId: config.projectId
            });
            
            logger.debug(`Storage client created with projectId: ${config.projectId}`);
            
            const file = storage.bucket(bucket).file(objectPath);
            
            // Check if file exists before deleting
            const [exists] = await file.exists();
            if (!exists) {
                logger.warn(`File does not exist in cloud storage: ${objectPath}`);
                return;
            }
            
            await file.delete();
            logger.info(`Successfully deleted file from LOCAL_CLOUD (SDK fallback): ${objectPath}`);
        }
    } catch (error) {
        // Check if it's a credential error (credentials need refresh)
        if (isCredentialError(error)) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to delete file from LOCAL_CLOUD: Credentials need refresh. Please run 'gcloud auth application-default login'`, {
                error: errorMessage,
                objectPath,
                bucket,
                targetServiceAccount
            });
            // Don't throw - allow cleanup to continue with other files
            // The file will be retried on next cleanup run
            return;
        }
        
        logger.error(`Failed to delete file from LOCAL_CLOUD: ${error}`);
        throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Delete file from GCLOUD mode (using VM service account)
 */
async function deleteFileFromGCloud(
    bucket: string,
    objectPath: string
): Promise<void> {
    try {
        logger.info(`Deleting file from GCLOUD: bucket=${bucket}, objectPath=${objectPath}`);
        
        const config = getStorageConfig();
        const storage = new Storage({ 
            projectId: config.projectId 
        }); // Uses VM SA; will "sign with IAM" automatically

        const file = storage.bucket(bucket).file(objectPath);
        
        // Check if file exists before deleting
        const [exists] = await file.exists();
        if (!exists) {
            logger.warn(`File does not exist in cloud storage: ${objectPath}`);
            return;
        }
        
        await file.delete();
        logger.info(`Successfully deleted file from GCLOUD: ${objectPath}`);
    } catch (error) {
        logger.error(`Failed to delete file from GCLOUD: ${error}`);
        throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Get file metadata (name and size) from GCS URL
 * Returns null if file is not in GCS or if metadata cannot be retrieved
 */
export async function getFileMetadataFromGcsUrl(gcsUrl: string): Promise<FileMetadata | null> {
    try {
        // Check if URL is a GCS URL
        if (!gcsUrl.startsWith('https://storage.googleapis.com/') && 
            !gcsUrl.startsWith('http://storage.googleapis.com/')) {
            logger.debug(`URL is not a GCS URL: ${gcsUrl}`);
            return null;
        }

        const config = getStorageConfig();
        if (config.mode === 'LOCAL') {
            logger.debug(`Storage mode is LOCAL, cannot get GCS metadata`);
            return null;
        }

        if (!config.bucket) {
            logger.warn(`GCLOUD_BUCKET not configured`);
            return null;
        }

        // Parse GCS URL to extract bucket and object path
        const url = new URL(gcsUrl);
        const pathParts = url.pathname.substring(1).split('/');
        
        if (pathParts.length < 2) {
            logger.warn(`Invalid GCS URL format: ${gcsUrl}`);
            return null;
        }

        const bucketName = pathParts[0];
        const objectPath = pathParts.slice(1).join('/');

        logger.debug(`Getting metadata for GCS file: bucket=${bucketName}, objectPath=${objectPath}`);

        // Get file metadata based on storage mode
        if (config.mode === 'GCLOUD') {
            const storage = new Storage({ 
                projectId: config.projectId 
            });
            const file = storage.bucket(bucketName).file(objectPath);
            
            const [exists] = await file.exists();
            if (!exists) {
                logger.warn(`File does not exist in GCS: ${objectPath}`);
                return null;
            }

            const [metadata] = await file.getMetadata();
            const fileName = metadata.name ? basename(metadata.name) : basename(objectPath);
            const fileSize = typeof metadata.size === 'string' 
                ? parseInt(metadata.size, 10) 
                : (typeof metadata.size === 'number' ? metadata.size : 0);
            
            return {
                name: fileName,
                size: fileSize,
                contentType: metadata.contentType
            };
        } else if (config.mode === 'LOCAL_CLOUD' && config.targetServiceAccount) {
            // For LOCAL_CLOUD mode, use gcloud CLI to get metadata
            try {
                const { execSync } = await import('child_process');
                const gcloudCommand = `gcloud storage objects describe gs://${bucketName}/${objectPath} --impersonate-service-account=${config.targetServiceAccount} --format=json`;
                
                const output = execSync(gcloudCommand, { 
                    encoding: 'utf8',
                    timeout: 10000,
                    env: { 
                        ...process.env, 
                        GOOGLE_APPLICATION_CREDENTIALS: '/Users/macbook/.config/gcloud/application_default_credentials.json'
                    }
                }).trim();
                
                const metadata = JSON.parse(output);
                const fileName = metadata.name ? basename(metadata.name) : basename(objectPath);
                
                return {
                    name: fileName,
                    size: parseInt(metadata.size || '0', 10),
                    contentType: metadata.contentType
                };
            } catch (gcloudError) {
                logger.warn(`Failed to get metadata via gcloud CLI: ${gcloudError}`);
                // Fallback: extract filename from URL
                const fileName = basename(objectPath);
                return {
                    name: fileName,
                    size: 0, // Size unknown
                };
            }
        }

        return null;
    } catch (error) {
        logger.error(`Failed to get file metadata from GCS URL: ${error}`);
        // Return null instead of throwing to allow the operation to continue without metadata
        return null;
    }
}
