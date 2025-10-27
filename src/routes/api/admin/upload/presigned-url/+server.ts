import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePresignedUrl, generateFilePath } from '$lib/server/storage';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { fileName, contentType, expiresSeconds = 600 } = await request.json();

        if (!fileName) {
            return json(
                { error: 'fileName is required' },
                { status: 400 }
            );
        }

        // Infer content type from file extension if not provided
        let inferredContentType = contentType;
        if (!inferredContentType || inferredContentType.trim() === '') {
            const extension = fileName.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
                'apk': 'application/vnd.android.package-archive',
                'cpk': 'application/zip',
                'bin': 'application/octet-stream',
                'exe': 'application/x-msdownload',
                'sh': 'application/x-sh',
                'zip': 'application/zip',
                'tar': 'application/x-tar',
                'gz': 'application/gzip',
                'pdf': 'application/pdf',
                'txt': 'text/plain',
                'json': 'application/json',
                'xml': 'application/xml',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'mp4': 'video/mp4',
                'avi': 'video/x-msvideo',
                'mov': 'video/quicktime',
                'mp3': 'audio/mpeg',
                'wav': 'audio/wav'
            };
            inferredContentType = mimeTypes[extension || ''] || 'application/octet-stream';
            logger.info(`Inferred content type for ${fileName}: ${inferredContentType}`);
        }

        // Create a mock file object to generate the file path
        const mockFile = {
            name: fileName,
            type: inferredContentType
        } as File;

        const objectPath = generateFilePath(mockFile);
        
        logger.info(`Generating presigned URL for: ${objectPath} (${inferredContentType})`);

        const result = await generatePresignedUrl(objectPath, inferredContentType, expiresSeconds);

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
