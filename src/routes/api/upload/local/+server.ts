import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

const UPLOAD_DIR = join(process.cwd(), 'static', 'uploads', 'iot');

export const PUT: RequestHandler = async ({ request, url }) => {
    try {
        const path = url.searchParams.get('path');
        const contentType = url.searchParams.get('contentType') || 'application/octet-stream';

        if (!path) {
            return json(
                { error: 'path parameter is required' },
                { status: 400 }
            );
        }

        logger.info(`Local upload request for path: ${path}, contentType: ${contentType}`);

        // Ensure upload directory exists
        if (!existsSync(UPLOAD_DIR)) {
            mkdirSync(UPLOAD_DIR, { recursive: true });
        }

        // Get the file data from the request body
        const fileData = await request.arrayBuffer();
        
        if (fileData.byteLength === 0) {
            return json(
                { error: 'No file data received' },
                { status: 400 }
            );
        }

        // Create the full file path
        const fullPath = join(UPLOAD_DIR, path);
        const dir = join(fullPath, '..');
        
        // Ensure the directory exists
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }

        // Write the file
        writeFileSync(fullPath, Buffer.from(fileData));
        
        logger.info(`File saved locally: ${fullPath} (size=${fileData.byteLength} bytes)`);

        // Return the URL that can be used to access the file
        const fileUrl = `/uploads/iot/${path}`;
        
        return json({
            success: true,
            url: fileUrl,
            path: path,
            size: fileData.byteLength
        });

    } catch (error) {
        logger.error(`Failed to upload file locally: ${error}`);
        return json(
            { 
                error: 'Failed to upload file',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
