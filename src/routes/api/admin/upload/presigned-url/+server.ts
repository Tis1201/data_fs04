import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePresignedUrl, generateFilePath } from '$lib/server/storage';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { fileName, contentType, expiresSeconds = 600 } = await request.json();

        if (!fileName || !contentType) {
            return json(
                { error: 'fileName and contentType are required' },
                { status: 400 }
            );
        }

        // Create a mock file object to generate the file path
        const mockFile = {
            name: fileName,
            type: contentType
        } as File;

        const objectPath = generateFilePath(mockFile);
        
        logger.info(`Generating presigned URL for: ${objectPath} (${contentType})`);

        const result = await generatePresignedUrl(objectPath, contentType, expiresSeconds);

        return json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error(`Failed to generate presigned URL: ${error}`);
        return json(
            { 
                error: 'Failed to generate presigned URL',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
