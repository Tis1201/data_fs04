import { Storage } from '@google-cloud/storage';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';
import { join, dirname } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

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

        // Use local ADC (user creds)
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

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires,
            contentType,
        });

        logger.info(`Presigned URL generated successfully for: ${objectPath}`);

        return {
            url,
            bucket,
            objectPath,
            contentType,
            expires
        };
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
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires,
            contentType
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

    if (!config.bucket) {
        throw new Error('GCLOUD_BUCKET environment variable is required for presigned URL generation');
    }

    switch (config.mode) {
        case 'LOCAL_CLOUD':
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
    expiresSeconds: number = 3600
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
                expiresSeconds
            );

        case 'GCLOUD':
            return await generateDownloadUrlGCloud(
                config.bucket,
                objectPath,
                expiresSeconds
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
    expiresSeconds: number = 3600
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);

        logger.info(`Generating download URL for LOCAL_CLOUD: bucket=${bucket}, objectPath=${objectPath}, targetSA=${targetServiceAccount}`);

        // Use local ADC (user creds)
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

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires,
            responseDisposition: 'attachment'
        });
        
        logger.debug(`Generated download URL for LOCAL_CLOUD: ${url}`);

        logger.info(`Download URL generated successfully for: ${objectPath}`);

        return {
            url,
            bucket,
            objectPath,
            contentType: 'application/octet-stream', // Default for downloads
            expires
        };
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
    expiresSeconds: number = 3600
): Promise<PresignedUrlResult> {
    try {
        const expires = Date.now() + (expiresSeconds * 1000);
        const config = getStorageConfig();
        const storage = new Storage({ 
            projectId: config.projectId 
        }); // Uses VM SA; will "sign with IAM" automatically

        const file = storage.bucket(bucket).file(objectPath);
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires,
            responseDisposition: 'attachment'
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
