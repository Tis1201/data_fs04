import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { join } from 'path';
import { existsSync } from 'fs';
import { restrict } from '$lib/server/security/guards';
import { generateDownloadUrl, getStorageConfig } from '$lib/server/storage';

/**
 * GET handler for resource files
 * This endpoint serves the actual resource file content
 */
export const GET: RequestHandler = async ({ params, locals, request }) => {
    // Check if user is authenticated
    if (!locals.user) {
        throw error(401, {
            message: 'Authentication required',
            code: 'UNAUTHORIZED'
        });
    }
    
    // Check if user has required role
    if (!locals.user.systemRole || locals.user.systemRole !== SystemRole.USER && locals.user.systemRole !== SystemRole.ADMIN) {
        throw error(403, {
            message: 'Insufficient permissions',
            code: 'FORBIDDEN'
        });
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
                throw error(404, {
                    message: 'Resource not found',
                    code: 'RESOURCE_NOT_FOUND'
                });
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
                    throw error(403, {
                        message: 'You do not have permission to access this resource',
                        code: 'FORBIDDEN'
                    });
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
                // Check if we're using cloud storage
                if (storageConfig.mode !== 'LOCAL') {
                    try {
                        // Extract object path from the stored path
                        let objectPath = resource.path;
                        
                        if (resource.path.startsWith('https://storage.googleapis.com/')) {
                            // Extract the object path from the full URL
                            const url = new URL(resource.path);
                            // Remove the leading slash and the bucket name (first part after the slash)
                            const pathParts = url.pathname.substring(1).split('/');
                            if (pathParts.length > 1) {
                                objectPath = pathParts.slice(1).join('/'); // Remove bucket name, keep the rest
                            } else {
                                objectPath = pathParts[0];
                            }
                            logger.info(`Extracted object path from full URL: ${objectPath}`);
                        } else if (resource.path.includes('/')) {
                            // This is already an object path
                            objectPath = resource.path;
                            logger.info(`Using stored object path: ${objectPath}`);
                        } else {
                            logger.warn(`Unexpected resource path format: ${resource.path}`);
                            throw new Error(`Invalid resource path format: ${resource.path}`);
                        }
                        
                        logger.info(`Generating fresh download URL for cloud storage. Object path: ${objectPath}, filename: ${resource.name}`);
                        const downloadResult = await generateDownloadUrl(objectPath, 3600, resource.name); // 1 hour expiry
                        
                        logger.info(`Redirecting to presigned download URL: ${downloadResult.url}`);
                        
                        return new Response(null, {
                            status: 302,
                            headers: {
                                'Location': downloadResult.url,
                                'Cache-Control': 'no-cache'
                            }
                        });
                    } catch (downloadError) {
                        logger.error(`Failed to generate download URL: ${downloadError}`);
                    }
                }
                
                // Handle local file storage
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
                    throw error(404, {
                        message: 'File not found',
                        code: 'FILE_NOT_FOUND',
                        details: `The requested file '${resource.name}' does not exist on the server.`
                    });
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
            throw error(404, {
                message: `Resource file not found: ${resource.path || 'No path provided'}`,
                code: 'FILE_NOT_FOUND'
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            logger.error(`Error serving resource ${id}: ${errorMessage}`);
            
            // If it's already an HTTP error, rethrow it
            if (err instanceof Error && 'status' in err) {
                throw err;
            }
            
            // Otherwise, wrap it in a 500 error
            throw error(500, {
                message: 'Failed to serve resource',
                code: 'RESOURCE_SERVE_ERROR'
            });
        }
};
