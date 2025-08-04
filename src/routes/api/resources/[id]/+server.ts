import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { SystemRole } from '$lib/types/roles';
import { join } from 'path';
import { existsSync } from 'fs';
import { restrict } from '$lib/server/security/guards';

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
            const hasAccess = await locals.prisma.accountMembership.findFirst({
                where: {
                    accountId: resource.accountId,
                    userId: locals.user.id,
                    role: { not: 'SYSTEM' }
                }
            });
            
            const isCreator = resource.createdBy === locals.user.id;
            
            if (!hasAccess && !isCreator) {
                throw error(403, {
                    message: 'You do not have permission to access this resource',
                    code: 'FORBIDDEN'
                });
            }
            
            // Log the resource details for debugging
            logger.info(`Serving resource: ${JSON.stringify({
                id: resource.id,
                path: resource.path,
                type: resource.type
            })}`);
            
            // Normalize the path to ensure it works correctly
            let staticPath: string;
            let fallbackUsed = false;
            
            if (resource.path) {
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
                    // If the file doesn't exist, use a default image based on the resource type
                    logger.warn(`File not found at ${fullPath}, using fallback`);
                    fallbackUsed = true;
                    
                    if (resource.type === 'image') {
                        staticPath = '/uploads/default.png';
                    } else {
                        // For non-image resources, we could have different defaults based on type
                        staticPath = '/uploads/default.png';
                    }
                }
                
                logger.info(`Redirecting to static path: ${staticPath}${fallbackUsed ? ' (fallback)' : ''}`);
                
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
