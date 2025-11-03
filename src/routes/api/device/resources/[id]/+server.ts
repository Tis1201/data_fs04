import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';
import { restrictJWT, type JWTAuthenticatedEvent } from '$lib/server/security/jwt-guard';
import { withRateLimit, deviceIdKeyGenerator } from '$lib/server/security/rate-limit';
import { join } from 'path';
import { existsSync } from 'fs';
import { generateDownloadUrl, getStorageConfig } from '$lib/server/storage';

/**
 * GET handler for resource files - JWT authenticated version
 * This endpoint serves the actual resource file content for device clients
 * 
 * Features:
 * - JWT Bearer token authentication
 * - Rate limiting (50 downloads per minute per device)
 * - Access control via ZenStack policies
 * - Support for both local and cloud storage (GCS)
 * 
 * Usage:
 * ```
 * curl -H "Authorization: Bearer <jwt_token>" \
 *      http://localhost:5173/api/resources-jwt/{resource_id}
 * ```
 */
export const GET: RequestHandler = restrictJWT(
  async (event: JWTAuthenticatedEvent) => {
    // Apply rate limiting: 50 downloads per minute per device
    return withRateLimit(
      {
        maxRequests: 50,
        windowSeconds: 60,
        keyGenerator: deviceIdKeyGenerator
      },
      async () => {
        const { params, locals, auth, deviceId, accountId } = event;
        const { id } = params;
        
        logger.info(`[JWT] Resource download request`, {
          resourceId: id,
          userId: auth.user.id,
          deviceId,
          accountId
        });
        
        try {
          // Find the resource - ZenStack will automatically filter based on account access
          const resource = await locals.prisma.resource.findUnique({
            where: { id },
            select: {
              id: true,
              path: true,
              type: true,
              name: true,
              accountId: true,
              createdBy: true,
              size: true,
              format: true
            }
          });
          
          // If resource doesn't exist or user doesn't have access (filtered by ZenStack)
          if (!resource) {
            logger.warn(`[JWT] Resource not found or access denied`, {
              resourceId: id,
              userId: auth.user.id,
              accountId
            });
            
            return json({
              success: false,
              error: 'Resource not found',
              message: 'The requested resource does not exist or you do not have access to it'
            }, { status: 404 });
          }
          
          // Log successful access
          logger.info(`[JWT] Resource access granted`, {
            resourceId: resource.id,
            resourceName: resource.name,
            resourceAccount: resource.accountId,
            userId: auth.user.id,
            userAccount: accountId,
            deviceId
          });
          
          // Check storage configuration
          const storageConfig = getStorageConfig();
          logger.debug(`[JWT] Storage config: ${storageConfig.mode}`);
          
          if (resource.path) {
            // Handle cloud storage (GCS)
            if (storageConfig.mode !== 'LOCAL') {
              try {
                let objectPath = resource.path;
                
                // Extract object path from full URL if needed
                if (resource.path.startsWith('https://storage.googleapis.com/')) {
                  const url = new URL(resource.path);
                  const pathParts = url.pathname.substring(1).split('/');
                  if (pathParts.length > 1) {
                    objectPath = pathParts.slice(1).join('/');
                  } else {
                    objectPath = pathParts[0];
                  }
                  logger.debug(`[JWT] Extracted object path: ${objectPath}`);
                }
                
                logger.info(`[JWT] Generating presigned URL for cloud storage`);
                const downloadResult = await generateDownloadUrl(objectPath, 3600, resource.name); // 1 hour expiry
                
                logger.info(`[JWT] Redirecting to presigned URL`, {
                  resourceId: id,
                  deviceId
                });
                
                return new Response(null, {
                  status: 302,
                  headers: {
                    'Location': downloadResult.url,
                    'Cache-Control': 'no-cache',
                    'X-Resource-Id': resource.id,
                    'X-Resource-Name': encodeURIComponent(resource.name),
                    'X-Resource-Size': String(resource.size)
                  }
                });
              } catch (downloadError) {
                logger.error(`[JWT] Failed to generate download URL`, {
                  error: downloadError instanceof Error ? downloadError.message : String(downloadError),
                  resourceId: id,
                  deviceId
                });
                
                return json({
                  success: false,
                  error: 'Download URL generation failed',
                  message: 'Unable to generate download URL for cloud storage'
                }, { status: 500 });
              }
            }
            
            // Handle local file storage
            let filePath = resource.path;
            
            // Remove leading slash if present
            if (filePath.startsWith('/')) {
              filePath = filePath.substring(1);
            }
            
            // Ensure the path starts with 'uploads/'
            let staticPath: string;
            if (filePath.startsWith('uploads/')) {
              staticPath = `/${filePath}`;
            } else {
              staticPath = `/uploads/${filePath.split('/').pop()}`;
            }
            
            // Check if the file exists
            const fullPath = join(process.cwd(), 'static', staticPath.startsWith('/') ? staticPath.substring(1) : staticPath);
            const fileExists = existsSync(fullPath);
            
            if (!fileExists) {
              logger.error(`[JWT] File not found`, {
                path: fullPath,
                resourceId: id,
                deviceId
              });
              
              return json({
                success: false,
                error: 'File not found',
                message: `The file '${resource.name}' does not exist on the server`
              }, { status: 404 });
            }
            
            logger.info(`[JWT] Redirecting to local static file`, {
              path: staticPath,
              resourceId: id,
              deviceId
            });
            
            // Return a redirect to the static file
            return new Response(null, {
              status: 302,
              headers: {
                'Location': staticPath,
                'X-Resource-Id': resource.id,
                'X-Resource-Name': encodeURIComponent(resource.name),
                'X-Resource-Size': String(resource.size)
              }
            });
          }
          
          // If no path is available
          logger.error(`[JWT] Resource has no path`, {
            resourceId: id,
            deviceId
          });
          
          return json({
            success: false,
            error: 'Resource path not found',
            message: 'The resource does not have a valid file path'
          }, { status: 404 });
          
        } catch (err) {
          logger.error(`[JWT] Error serving resource`, {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            resourceId: id,
            userId: auth.user.id,
            deviceId
          });
          
          return json({
            success: false,
            error: 'Resource download failed',
            message: err instanceof Error ? err.message : 'Unknown error occurred'
          }, { status: 500 });
        }
      }
    )(event);
  },
  ['ADMIN', 'MEMBER', 'USER'] // Allow admin, member, and regular users
);

