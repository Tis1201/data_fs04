import { error } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { join } from 'path';
import { existsSync } from 'fs';
import { getStorageConfig, convertGCloudUrlToSignedDownloadUrl } from '$lib/server/storage';
import { extractFilenameWithExtension } from '$lib/server/storage/gcloudUrlUtils';

/**
 * GET handler for resource files.
 * ?format=json: returns { downloadUrl, fileName, downloadAuth? } for browser-direct CDN fetch (no server proxy).
 * Without format=json + LOCAL: redirects to static file. R2: returns 400 (use format=json).
 */
export const GET: RequestHandler = async ({ params, locals, request, url }) => {
    // Check if user is authenticated
    if (!locals.user) {
        throw error(401, 'Authentication required');
    }
    
    // Check if user has required role
    if (!locals.user.systemRole || locals.user.systemRole !== SystemRole.USER && locals.user.systemRole !== SystemRole.ADMIN) {
        throw error(403, 'Insufficient permissions');
    }
        const { id } = params;
        
        logger.info(`=== RESOURCE DOWNLOAD REQUEST ===`);
        logger.info(`Resource ID: ${id}`);
        logger.info(`Request URL: ${request.url}`);
        logger.info(`Request headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()))}`);
        
        try {
            // Find the resource in the database
            const resource = await locals.prisma.resource.findUnique({
                where: { id },
                select: {
                    id: true,
                    path: true,
                    type: true,
                    name: true,
                    accountId: true,
                    createdBy: true
                }
            });
            
            // If resource doesn't exist, return a 404 error
            if (!resource) {
                throw error(404, 'Resource not found');
            }
            
            // Check if the user has access to this resource
            // User can access if they belong to the account that owns the resource
            logger.info(`Checking access for user ${locals.user.id} to resource with accountId: ${resource.accountId}`);
            
            const hasAccess = await locals.prisma.accountMembership.findFirst({
                where: {
                    accountId: resource.accountId,
                    userId: locals.user.id,
                    role: { not: 'SYSTEM' }
                }
            });
            
            logger.info(`Account membership check result: ${hasAccess ? 'ACCESS GRANTED' : 'ACCESS DENIED'}`);
            
            if (!hasAccess) {
                // Also check if user is admin (admin can access all resources)
                const isAdmin = locals.user.systemRole === 'ADMIN';
                logger.info(`User is admin: ${isAdmin}`);
                
                if (!isAdmin) {
                    throw error(403, 'You do not have permission to access this resource');
                }
            }
            
            // Log the resource details for debugging
            logger.info(`Serving resource: ${JSON.stringify({
                id: resource.id,
                path: resource.path,
                type: resource.type
            })}`);
            
            // Check storage configuration
            const storageConfig = getStorageConfig();
            logger.info(`Storage config: ${JSON.stringify(storageConfig)}`);
            logger.info(`Resource path: ${resource.path}`);
            
            if (resource.path) {
                const wantJson = url.searchParams.get('format') === 'json';
                const fileName = extractFilenameWithExtension(resource.path, resource.name);

                // ?format=json: return { downloadUrl, fileName, downloadAuth? } for browser-direct (no server proxy)
                if (wantJson) {
                    const result = await convertGCloudUrlToSignedDownloadUrl(resource.path, 3600, fileName);
                    if (!result) {
                        throw error(500, 'Failed to generate download URL');
                    }
                    return json({
                        downloadUrl: result.downloadUrl,
                        fileName,
                        ...(result.downloadAuth && { downloadAuth: result.downloadAuth })
                    });
                }

                // Without format=json: R2 no longer supported (browser-direct only)
                if (storageConfig.mode !== 'LOCAL') {
                    throw error(400, 'Use ?format=json for browser-direct download. R2 no longer uses server proxy.');
                }

                // LOCAL: redirect to static file
                let staticPath: string;
                
                // Extract the filename from the path
                let filePath = resource.path;
                
                // Remove leading slash if present
                if (filePath.startsWith('/')) {
                    filePath = filePath.substring(1);
                }
                
                // Ensure the path starts with 'uploads/'
                if (filePath.startsWith('uploads/')) {
                    staticPath = `/${filePath}`;
                } else {
                    // If it doesn't have the uploads/ prefix, add it
                    staticPath = `/uploads/${filePath.split('/').pop()}`;
                }
                
                // Check if the file exists in the static directory
                const fullPath = join(process.cwd(), 'static', staticPath.startsWith('/') ? staticPath.substring(1) : staticPath);
                const fileExists = existsSync(fullPath);
                
                if (!fileExists) {
                    logger.error(`File not found at ${fullPath}`);
                    throw error(404, 'File not found');
                }
                
                logger.info(`Redirecting to static path: ${staticPath}`);
                
                // Return a redirect to the static file
                return new Response(null, {
                    status: 302,
                    headers: {
                        'Location': staticPath
                    }
                });
            }
            
            // If we couldn't determine a path, return an error
            logger.warn(`Could not determine proper path for resource: ${resource.id}, path: ${resource.path || 'undefined'}`);
            throw error(404, `Resource file not found: ${resource.path || 'No path provided'}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`Error serving resource ${id}: ${errorMessage}`);
            
            // If it's already an HTTP error, rethrow it
            if (err instanceof Error && 'status' in err) {
                throw err;
            }
            
            // Otherwise, wrap it in a 500 error
            throw error(500, 'Failed to serve resource');
        }
};
