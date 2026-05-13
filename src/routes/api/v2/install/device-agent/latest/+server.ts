// import { json, type RequestHandler } from '@sveltejs/kit';
// import { verifyFactoryJWT } from '$lib/server/device/deviceJWTChecker';
// import { convertGCloudUrlToSignedDownloadUrl } from '$lib/server/storage/gcloudUrlUtils';
// import { logger } from '$lib/server/logger';
// import { getClientIp } from '$lib/utils/request-utils';
// import { createErrorResponse, createSuccessResponse } from '$lib/server/types/api';
//
// /**
//  * GET /api/v2/install/device-agent/latest
//  *
//  * Returns the latest device agent package download URL for a given platform and architecture.
//  * Requires factory JWT authentication (same JWT used for MQTT factory connections).
//  *
//  * Query Parameters:
//  * - platform: "linux" | "darwin" | "windows" (default: "linux")
//  * - arch: "amd64" | "arm64" | "armhf" (default: "amd64")
//  *
//  * Headers:
//  * - Authorization: Bearer {DEVICE_FACTORY_JWT_TOKEN}
//  *
//  * Response:
//  * {
//  *   "success": true,
//  *   "data": {
//  *     "packageName": "com.datarealities.device.client",
//  *     "version": "1.0.0",
//  *     "format": "deb",
//  *     "platform": "linux",
//  *     "architecture": "amd64",
//  *     "downloadUrl": "https://storage.googleapis.com/...",
//  *     "expiresAt": "2024-01-16T12:00:00Z",
//      *     "sha256": "abc123...",
//  *     "size": 12345678
//  *   }
//  * }
//  */
// export const GET: RequestHandler = async (event) => {
//   const { request, locals, url } = event;
//
//   try {
//     // Verify factory JWT
//     const { claims, token: factoryTokenString } = await verifyFactoryJWT(locals, request);
//     const factoryJwtId = claims.jti as string | undefined;
//     const clientIp = getClientIp(event);
//     const userAgent = request.headers.get('user-agent') ?? null;
//
//     logger.info('[DeviceAgentInstallAPI] Factory JWT verified', {
//       factoryJwtId,
//       clientIp,
//       userAgent
//     });
//
//     // Get query parameters
//     const platform = url.searchParams.get('platform') || 'linux';
//     const arch = url.searchParams.get('arch') || 'amd64';
//
//     // Validate platform
//     const validPlatforms = ['linux', 'darwin', 'windows'];
//     if (!validPlatforms.includes(platform)) {
//       return json(
//         createErrorResponse(`Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}`),
//         { status: 400 }
//       );
//     }
//
//     // Validate architecture
//     const validArchs = ['amd64', 'arm64', 'armhf'];
//     if (!validArchs.includes(arch)) {
//       return json(
//         createErrorResponse(`Invalid architecture: ${arch}. Must be one of: ${validArchs.join(', ')}`),
//         { status: 400 }
//       );
//     }
//
//     // Determine package format based on platform
//     let format: string;
//     switch (platform) {
//       case 'linux':
//         format = 'deb';
//         break;
//       case 'darwin':
//         format = 'pkg';
//         break;
//       case 'windows':
//         format = 'exe';
//         break;
//       default:
//         format = 'deb';
//     }
//
//     // Find latest device agent resource
//     // Note: Resource model doesn't have platform/architecture fields
//     // Filter by packageName and format, then match by filename pattern
//     const resource = await locals.prisma.resource.findFirst({
//       where: {
//         packageName: 'com.datarealities.device.client',
//         format: format
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });
//
//     if (!resource) {
//       logger.warn('[DeviceAgentInstallAPI] Device agent not found', {
//         platform,
//         arch,
//         format,
//         factoryJwtId
//       });
//
//       return json(
//         createErrorResponse(
//           `Device agent not found for platform=${platform}, arch=${arch}, format=${format}`,
//           {
//             details: {
//               platform,
//               architecture: arch,
//               format
//             }
//           }
//         ),
//         { status: 404 }
//       );
//     }
//
//     // Check if resource has a path (GCloud URL or local path)
//     if (!resource.path) {
//       logger.error('[DeviceAgentInstallAPI] Resource missing path', {
//         resourceId: resource.id,
//         platform,
//         arch
//       });
//
//       return json(
//         createErrorResponse('Device agent resource is missing download path'),
//         { status: 500 }
//       );
//     }
//
//     // Generate presigned download URL (expires in 1 hour)
//     const expiresSeconds = 3600; // 1 hour
//     const downloadUrlResult = await convertGCloudUrlToSignedDownloadUrl(
//       resource.path,
//       expiresSeconds,
//       resource.name
//     );
//
//     if (!downloadUrlResult) {
//       logger.error('[DeviceAgentInstallAPI] Failed to generate presigned URL', {
//         resourceId: resource.id,
//         path: resource.path
//       });
//
//       return json(
//         createErrorResponse('Failed to generate download URL'),
//         { status: 500 }
//       );
//     }
//
//     // Calculate expiration timestamp
//     const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();
//
//     // Log download request for audit trail
//     // Note: AuditLog requires userId, but factory JWT doesn't have a user
//     // Skip audit logging for factory JWT downloads, or use system user if available
//     // For now, we'll just log to application logs
//     logger.info('[DeviceAgentInstallAPI] Device agent download requested', {
//       resourceId: resource.id,
//       packageName: resource.packageName,
//       version: resource.version,
//       platform,
//       architecture: arch,
//       format,
//       factoryJwtId,
//       clientIp,
//       userAgent
//     });
//
//     logger.info('[DeviceAgentInstallAPI] Device agent download URL generated', {
//       resourceId: resource.id,
//       packageName: resource.packageName,
//       version: resource.version,
//       platform,
//       arch,
//       factoryJwtId,
//       clientIp
//     });
//
//     // Return download metadata
//     // Note: Resource model doesn't have platform/architecture/sha256 fields
//     // Use query parameters and map signature field to sha256 for install script compatibility
//     return json(
//       createSuccessResponse({
//         packageName: resource.packageName,
//         version: resource.version || 'unknown',
//         format: resource.format || format,
//         platform: platform, // From query parameter
//         architecture: arch, // From query parameter
//         downloadUrl: downloadUrlResult.downloadUrl,
//         expiresAt: expiresAt,
//         sha256: resource.signature || null, // Map signature field to sha256 for install script
//         size: resource.size || null
//       })
//     );
//   } catch (err) {
//     // Handle Response objects (from verifyFactoryJWT)
//     if (err instanceof Response) {
//       return err;
//     }
//
//     const message = err instanceof Error ? err.message : String(err);
//     logger.error('[DeviceAgentInstallAPI] Error', {
//       error: message,
//       stack: err instanceof Error ? err.stack : undefined
//     });
//
//     // Check if it's an authentication error
//     if (message.includes('Unauthorized') || message.includes('Invalid') || message.includes('factory')) {
//       return json(
//         createErrorResponse('Unauthorized factory token', {
//           details: { message }
//         }),
//         { status: 401 }
//       );
//     }
//
//     // Generic error
//     return json(
//       createErrorResponse('Internal server error', {
//         details: { message }
//       }),
//       { status: 500 }
//     );
//   }
// };
