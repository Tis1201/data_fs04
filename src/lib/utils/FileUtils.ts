import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
// import { uploadToS3, getObjectUrl } from '$lib/server/s3/S3';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';
import { handleFileUpload } from '$lib/server/storage';

// Define the upload directory - in a real app, this would be configurable
const UPLOAD_DIR = join(process.cwd(), 'static', 'uploads', 'iot');

/**
 * Ensure the upload directory exists
 */
function generateUploadDirectory() {
    if (!existsSync(UPLOAD_DIR)) {
        try {
            mkdirSync(UPLOAD_DIR, { recursive: true });
            logger.info(`Created upload directory: ${UPLOAD_DIR}`);
        } catch (err) {
            logger.error(`Failed to create upload directory: ${err}`);
        }
    }
}

/**
 * Minimal MIME, v4 to extension map for fallback when file.name is missing.
 * Expand if you need more types.
*/
export const MIME_EXT_MAP: Record<string, string> = {
    // Supported file types
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/vnd.android.package-archive': 'apk',
    'application/octet-stream': 'cpk', // Custom package files
    
    // Legacy mappings (for reference, but not allowed)
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/x-sh': 'sh'
};


/**
 * Infer resource type and format from the uploaded file.
 * Only supports .zip, .cpk, and .apk files.
 */
export function inferTypeAndFormatFromFile(file: File): { type: string; format: string } {
    const mime = file.type || '';
    let type = 'file';
    let format = '';
    
    // Determine format from file extension first
    if (file.name && file.name.includes('.')) {
        format = file.name.split('.').pop()!.toLowerCase();
    } else if (mime && MIME_EXT_MAP[mime]) {
        format = MIME_EXT_MAP[mime];
    }
    
    // Set type based on format for supported file types
    if (format === 'apk') {
        type = 'application';
    } else if (format === 'zip') {
        type = 'archive';
    } else if (format === 'cpk') {
        type = 'package';
    } else {
        // Fallback for unsupported types (should not happen due to validation)
        type = 'file';
    }

    return { type, format };
}

/**
 * Persist the uploaded file using the configured storage system.
 * Supports LOCAL, LOCAL_CLOUD, and GCLOUD storage modes.
 */
export async function saveFile(file: File): Promise<string> {
    try {
        const result = await handleFileUpload(file);
        logger.debug(`File uploaded successfully: ${result.url} (path: ${result.path})`);
        return result.url;
    } catch (err: any) {
        logger.error(`Error saving file: ${String(err)}`);
        throw new Error(`Failed to save file: ${err.message || String(err)}`);
    }
}

