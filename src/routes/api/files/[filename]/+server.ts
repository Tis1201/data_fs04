import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { filename } = event.params;
        
        if (!filename) {
            return json({
                success: false,
                error: 'Filename is required'
            }, { status: 400 });
        }

        try {
            // For now, we'll serve files from a specific directory
            // In a real implementation, you'd want to:
            // 1. Store file metadata in the database
            // 2. Validate user permissions to access the file
            // 3. Serve files from a secure storage location
            
            const filesDirectory = process.env.FILES_DIRECTORY || '/tmp/device-files';
            const filePath = join(filesDirectory, filename);
            
            // Security check: ensure the file is within the allowed directory
            if (!filePath.startsWith(filesDirectory)) {
                return json({
                    success: false,
                    error: 'Invalid file path'
                }, { status: 400 });
            }
            
            // Check if file exists
            if (!existsSync(filePath)) {
                return json({
                    success: false,
                    error: 'File not found'
                }, { status: 404 });
            }
            
            // Get file stats
            const fileStats = await stat(filePath);
            const fileBuffer = await readFile(filePath);
            
            // Set appropriate headers
            const headers = new Headers();
            headers.set('Content-Type', 'application/octet-stream');
            headers.set('Content-Disposition', `attachment; filename="${filename}"`);
            headers.set('Content-Length', fileStats.size.toString());
            headers.set('Cache-Control', 'no-cache');
            
            logger.info(`[FileDownload] Serving file: ${filename} (${fileStats.size} bytes)`);
            
            return new Response(fileBuffer, {
                status: 200,
                headers
            });
            
        } catch (error) {
            logger.error(`[FileDownload] Error serving file ${filename}:`, error);
            return json({
                success: false,
                error: 'Failed to serve file'
            }, { status: 500 });
        }
    },
    ['ADMIN', 'USER']
);
