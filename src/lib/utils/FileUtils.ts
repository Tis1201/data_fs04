import { v4 as uuidv4 } from 'uuid';
import { join, dirname } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { uploadToS3, getObjectUrl } from '$lib/server/s3/S3';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';

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
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/x-sh': 'sh',
    'application/octet-stream': 'bin'
};


/**
 * Infer resource type and format from the uploaded file.
 */
export function inferTypeAndFormatFromFile(file: File): { type: string; format: string } {
    const mime = file.type || '';
    let type = 'file';
    if (mime.startsWith('image/')) {
        type = 'image';
    } else if (mime.startsWith('video/')) {
        type = 'video';
    } else if (
        mime.startsWith('text/') ||
        mime.includes('pdf') ||
        mime.includes('document') ||
        mime.includes('spreadsheet') ||
        mime.includes('presentation')
    ) {
        type = 'document';
    }

    let format = '';
    if (file.name && file.name.includes('.')) {
        format = file.name.split('.').pop()!.toLowerCase();
    } else if (mime && MIME_EXT_MAP[mime]) {
        format = MIME_EXT_MAP[mime];
    }

    return { type, format };
}

/**
 * Persist the uploaded file locally (dev) or to S3 (prod), returning the public path/URL.
 * Infers extension from filename or MIME type if missing.
 */
export async function saveFile(file: File): Promise<string> {
    const uniqueId = uuidv4();

    // Determine file extension
    let fileExt = '';
    if (file.name && file.name.includes('.')) {
        fileExt = file.name.split('.').pop() || '';
    } else if (file.type && MIME_EXT_MAP[file.type]) {
        fileExt = MIME_EXT_MAP[file.type];
    }

    const safeFileName = fileExt ? `${uniqueId}.${fileExt}` : uniqueId;
    

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
            throw new Error('Uploaded file is empty (0 bytes)');
        }

        const isDev = env.NODE_ENV !== 'production';
        
        if (isDev) {
            generateUploadDirectory();
            const localPath = join(UPLOAD_DIR, safeFileName);
            writeFileSync(localPath, buffer);
            logger.debug(`Saved file locally: ${localPath} (size=${buffer.length})`);
            return `/uploads/iot/${safeFileName}`;
        } else {
            await uploadToS3(safeFileName, buffer, file.type);
            const url = getObjectUrl(safeFileName);
            logger.debug(`Uploaded file to S3: ${url} (size=${buffer.length})`);
            return url;
        }
    } catch (err: any) {
        logger.error(`Error saving file: ${String(err)}`);
        throw new Error(`Failed to save file: ${err.message || String(err)}`);
    }
}

