import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePresignedUrl, getStorageConfig } from '$lib/server/storage';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '$lib/server/logger';

/**
 * Generate presigned upload URL for DEB files
 * This bypasses Cloudflare's 100MB limit by uploading directly to GCS
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { fileName, fileSize, contentType } = body;

        if (!fileName) {
            return json({ success: false, error: 'fileName is required' }, { status: 400 });
        }

        // Validate it's a DEB file
        if (!fileName.toLowerCase().endsWith('.deb')) {
            return json({ success: false, error: 'File must be a DEB file' }, { status: 400 });
        }

        const config = getStorageConfig();
        
        // Generate unique path for temporary DEB file
        const uniqueId = uuidv4();
        const objectPath = `temp/deb-parser/${uniqueId}-${fileName}`;
        
        // Use appropriate content type
        const debContentType = contentType || 'application/vnd.debian.binary-package';

        logger.info('[DEB Parser] Generating presigned upload URL', {
            fileName,
            fileSize,
            objectPath,
            storageMode: config.mode
        });

        // Generate presigned URL (expires in 15 minutes)
        const presignedResult = await generatePresignedUrl(
            objectPath,
            debContentType,
            900 // 15 minutes
        );

        return json({
            success: true,
            data: {
                uploadUrl: presignedResult.url,
                objectPath: presignedResult.objectPath,
                bucket: presignedResult.bucket,
                expires: presignedResult.expires,
                // Return the object path to use when calling parse endpoint
                parseKey: presignedResult.objectPath
            }
        });
    } catch (error) {
        logger.error('[DEB Parser] Error generating upload URL', {
            error: error instanceof Error ? error.message : String(error)
        });
        return json({
            success: false,
            error: 'Failed to generate upload URL: ' + (error instanceof Error ? error.message : String(error))
        }, { status: 500 });
    }
};
