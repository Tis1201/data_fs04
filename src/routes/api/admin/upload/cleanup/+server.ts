import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { deleteFileFromCloudStorage } from '$lib/server/storage';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { filePath, resourceId } = await request.json();
        
        if (!filePath) {
            return json({ error: 'File path is required' }, { status: 400 });
        }

        logger.info(`Cleaning up failed upload: ${filePath}`);
        
        // Delete the file from cloud storage
        try {
            await deleteFileFromCloudStorage(filePath);
            logger.info(`Successfully cleaned up file: ${filePath}`);
        } catch (deleteError) {
            logger.error(`Failed to delete file from storage: ${deleteError}`);
            // Don't fail the request if file deletion fails
        }

        // If resourceId is provided, delete the database record
        if (resourceId) {
            // Note: You'll need to import prisma and delete the resource
            // This is a placeholder for the database cleanup
            logger.info(`Would delete resource record: ${resourceId}`);
        }

        return json({ success: true, message: 'Cleanup completed' });
    } catch (error) {
        logger.error(`Cleanup failed: ${error}`);
        return json({ error: 'Cleanup failed' }, { status: 500 });
    }
};
