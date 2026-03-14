import { json, redirect, type RequestHandler } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { convertGCloudUrlToSignedDownloadUrl, getStorageConfig } from '$lib/server/storage';
import path from 'path';

/**
 * Generate presigned download URL for browser
 * GET /api/devices/{deviceId}/pull-file-download-url?logId={logId}
 */
export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, url } = event;
        const deviceId = params.id;
        const logId = url.searchParams.get('logId');

        if (!logId) {
            return json({
                success: false,
                error: {
                    code: 'INVALID_REQUEST',
                    message: 'logId query parameter is required'
                }
            }, { status: 400 });
        }

        try {
            logger.info('[PullFileDownloadURL] Generating download URL', { deviceId, logId });

            // Verify device exists and user has access
            const device = await prisma.device.findUnique({
                where: { id: deviceId },
                select: {
                    id: true,
                    createdBy: true,
                    accountId: true,
                    account: {
                        select: {
                            members: {
                                select: {
                                    userId: true
                                }
                            }
                        }
                    }
                }
            });

            if (!device) {
                return json({
                    success: false,
                    error: {
                        code: 'DEVICE_NOT_FOUND',
                        message: 'Device not found'
                    }
                }, { status: 404 });
            }

            // Check if user has access to this device
            if (!event.auth?.user) {
                return json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'User not authenticated'
                    }
                }, { status: 401 });
            }

            const user = event.auth.user;
            if (user.systemRole !== SystemRole.ADMIN) {
                const isOwner = device.createdBy === user.id;
                const isAccountMember = device.accountId && device.account?.members?.some(
                    (member: { userId: string }) => member.userId === user.id
                );

                if (!isOwner && !isAccountMember) {
                    return json({
                        success: false,
                        error: {
                            code: 'FORBIDDEN',
                            message: 'Access denied to this device'
                        }
                    }, { status: 403 });
                }
            }

            // Look up action log by logId
            const actionLog = await prisma.deviceActionLog.findUnique({
                where: { id: logId },
                select: {
                    id: true,
                    deviceId: true,
                    actionType: true,
                    status: true,
                    metadata: true
                }
            });

            if (!actionLog) {
                return json({
                    success: false,
                    error: {
                        code: 'LOG_NOT_FOUND',
                        message: 'Action log not found'
                    }
                }, { status: 404 });
            }

            // Verify action log belongs to device
            if (actionLog.deviceId !== deviceId) {
                return json({
                    success: false,
                    error: {
                        code: 'FORBIDDEN',
                        message: 'Action log does not belong to this device'
                    }
                }, { status: 403 });
            }

            // Verify it's a pull_file or get_logs action
            if (actionLog.actionType !== 'pull_file' && actionLog.actionType !== 'get_logs') {
                return json({
                    success: false,
                    error: {
                        code: 'INVALID_ACTION',
                        message: 'Action log is not for a pull_file or get_logs operation'
                    }
                }, { status: 400 });
            }

            // Only return download URL when upload has completed successfully.
            // objectPath is stored at initiation, but the file does not exist in GCS until the device finishes uploading.
            // Returning early here prevents the polling loop from triggering download at ~15% (incomplete file).
            if (actionLog.status !== 'success') {
                return json({
                    success: false,
                    error: {
                        code: 'UPLOAD_IN_PROGRESS',
                        message: 'File upload not yet complete. Please wait for the device to finish uploading.',
                        details: `Action status is '${actionLog.status}'; download URL is only available when status is 'success'`
                    }
                }, { status: 400 });
            }

            // Extract objectPath from action log metadata
            const metadata = actionLog.metadata as any;
            let objectPath = metadata?.objectPath;
            const bucket = metadata?.bucket;

            // Log metadata for debugging
            logger.info('[PullFileDownloadURL] Action log metadata', {
                logId,
                metadata,
                objectPath,
                bucket
            });

            if (!objectPath) {
                logger.error('[PullFileDownloadURL] Object path not found in metadata', {
                    logId,
                    metadata,
                    actionType: actionLog.actionType
                });
                return json({
                    success: false,
                    error: {
                        code: 'MISSING_METADATA',
                        message: 'Object path not found in action log metadata',
                        details: 'The file upload may not have completed successfully, or metadata was not saved correctly.'
                    }
                }, { status: 400 });
            }

            // Validate objectPath format - it should be a full path like devices/{deviceId}/pull-files/{timestamp}/{fileName}
            // If it's just a UUID or filename, something went wrong
            if (!objectPath.includes('/') && objectPath.length < 50) {
                logger.error('[PullFileDownloadURL] Invalid objectPath format - appears to be just a filename/UUID', {
                    logId,
                    objectPath,
                    metadata
                });
                return json({
                    success: false,
                    error: {
                        code: 'INVALID_OBJECT_PATH',
                        message: 'Invalid object path format. Expected full path like devices/{deviceId}/pull-files/{timestamp}/{fileName}',
                        details: `Received: ${objectPath}`
                    }
                }, { status: 400 });
            }

            // Get storage config
            const storageConfig = getStorageConfig();
            const storageBucket = bucket || (storageConfig.mode === 'R2' ? storageConfig.r2Bucket : null);

            if (storageConfig.mode === 'R2' && !storageBucket) {
                return json({
                    success: false,
                    error: {
                        code: 'CONFIGURATION_ERROR',
                        message: 'R2 bucket not configured (CLOUDFLARE_R2_BUCKET_NAME)'
                    }
                }, { status: 500 });
            }

            // Extract filename from objectPath
            const fileName = path.basename(objectPath);

            // Generate download URL (R2: HMAC only, returns proxy URL; LOCAL: static file URL)
            logger.info('[PullFileDownloadURL] Generating download URL', {
                mode: storageConfig.mode,
                bucket: storageBucket,
                objectPath,
                fileName
            });

            let downloadUrlResult: { url: string; expires: number };

            if (storageConfig.mode === 'R2' && storageBucket) {
                const result = await convertGCloudUrlToSignedDownloadUrl(objectPath, 3600, fileName);
                if (!result) {
                    return json({
                        success: false,
                        error: {
                            code: 'CONFIGURATION_ERROR',
                            message: 'HMAC required for R2. Set CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC.'
                        }
                    }, { status: 500 });
                }
                // R2 uses HMAC only - return proxy URL (same-origin) to avoid CORS
                const origin = event.url.origin;
                downloadUrlResult = {
                    url: `${origin}/api/v2/devices/${deviceId}/pull-file-download-proxy?logId=${encodeURIComponent(logId)}`,
                    expires: result.expires
                };
            } else if (storageConfig.mode === 'LOCAL') {
                const baseUrl = process.env.PUBLIC_APP_URL || 'http://localhost:5173';
                const pathForUrl = objectPath.startsWith('/') ? objectPath : `/uploads/iot/${objectPath}`;
                downloadUrlResult = {
                    url: `${baseUrl.replace(/\/$/, '')}${pathForUrl}`,
                    expires: Date.now() + 3600 * 1000
                };
            } else {
                return json({
                    success: false,
                    error: { code: 'CONFIGURATION_ERROR', message: 'Storage mode not supported for download' }
                }, { status: 500 });
            }

            // Mark action log as downloaded (optional, for tracking)
            try {
                await prisma.deviceActionLog.update({
                    where: { id: logId },
                    data: {
                        metadata: {
                            ...metadata,
                            downloaded: true,
                            downloadedAt: new Date().toISOString()
                        }
                    }
                });
            } catch (updateError) {
                logger.warn('[PullFileDownloadURL] Failed to update action log metadata', {
                    error: updateError,
                    logId
                });
                // Don't fail the request if metadata update fails
            }

            logger.info('[PullFileDownloadURL] Download URL generated successfully', {
                logId,
                objectPath
            });

            // Return JSON response with download URL (and downloadAuth when HMAC is used)
            return json({
                success: true,
                downloadUrl: downloadUrlResult.url,
                fileName,
                objectPath,
                expires: downloadUrlResult.expires,
                ...(downloadUrlResult.downloadAuth && { downloadAuth: downloadUrlResult.downloadAuth })
            });

        } catch (error) {
            logger.error('[PullFileDownloadURL] Error generating download URL', {
                error: error instanceof Error ? error.message : String(error),
                deviceId,
                logId
            });

            return json({
                success: false,
                error: {
                    code: 'OPERATION_FAILED',
                    message: 'Failed to generate download URL',
                    details: error instanceof Error ? error.message : String(error)
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);

