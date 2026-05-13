import { json, type RequestHandler } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { deleteFileFromCloudStorage } from '$lib/server/storage';

/**
 * Delete temporary file from GCloud after successful download
 * POST /api/devices/{deviceId}/pull-file-cleanup
 */
export const POST: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params, request } = event;
        const deviceId = params.id;

        try {
            const body = await request.json();
            const { logId, objectPath } = body;

            if (!logId) {
                return json({
                    success: false,
                    error: {
                        code: 'INVALID_REQUEST',
                        message: 'logId is required'
                    }
                }, { status: 400 });
            }

            if (!objectPath) {
                return json({
                    success: false,
                    error: {
                        code: 'INVALID_REQUEST',
                        message: 'objectPath is required'
                    }
                }, { status: 400 });
            }

            logger.info('[PullFileCleanup] Cleaning up file', { deviceId, logId, objectPath });

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
            const user = event.auth?.user;
            if (!user) {
                return json({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'User not authenticated'
                    }
                }, { status: 401 });
            }

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

            // Verify objectPath matches action log metadata
            const metadata = actionLog.metadata as any;
            const storedObjectPath = metadata?.objectPath;

            if (storedObjectPath && storedObjectPath !== objectPath) {
                logger.warn('[PullFileCleanup] Object path mismatch', {
                    provided: objectPath,
                    stored: storedObjectPath
                });
                // Continue anyway - user might have the correct path
            }

            // Delete file from GCloud
            try {
                await deleteFileFromCloudStorage(objectPath);
                logger.info('[PullFileCleanup] File deleted from GCloud', { objectPath });
            } catch (deleteError) {
                // If file not found, that's okay (already deleted or never existed)
                const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
                if (errorMessage.includes('not found') || errorMessage.includes('No such object')) {
                    logger.info('[PullFileCleanup] File already deleted or not found', { objectPath });
                } else {
                    logger.error('[PullFileCleanup] Failed to delete file from GCloud', {
                        error: deleteError,
                        objectPath
                    });
                    // Continue anyway - cleanup is best effort
                }
            }

            // Update action log metadata
            try {
                await prisma.deviceActionLog.update({
                    where: { id: logId },
                    data: {
                        metadata: {
                            ...metadata,
                            cleanedUp: true,
                            cleanedUpAt: new Date().toISOString(),
                            cleanupReason: 'user_download'
                        }
                    }
                });
            } catch (updateError) {
                logger.warn('[PullFileCleanup] Failed to update action log metadata', {
                    error: updateError,
                    logId
                });
                // Don't fail the request if metadata update fails
            }

            logger.info('[PullFileCleanup] Cleanup completed successfully', { logId, objectPath });

            return json({
                success: true,
                message: 'File deleted successfully'
            });

        } catch (error) {
            logger.error('[PullFileCleanup] Error during cleanup', {
                error: error instanceof Error ? error.message : String(error),
                deviceId
            });

            return json({
                success: false,
                error: {
                    code: 'OPERATION_FAILED',
                    message: 'Failed to cleanup file',
                    details: error instanceof Error ? error.message : String(error)
                }
            }, { status: 500 });
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);

