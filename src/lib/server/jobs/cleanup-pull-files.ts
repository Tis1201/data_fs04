import prisma from '$lib/server/prisma';
import { Prisma } from '@prisma/client';
import { deleteFileFromCloudStorage } from '$lib/server/storage';
import { logger } from '$lib/server/logger';
import { getStorageConfig } from '$lib/server/storage';
import { isCredentialError } from '$lib/server/storage/gcloudAuthUtils';

const CLEANUP_TIMEOUT_HOURS = parseInt(process.env.PULL_FILE_CLEANUP_TIMEOUT_HOURS || '24');

/**
 * Clean up pull files and logs that were uploaded to GCloud
 * This job runs periodically (every hour) and cleans up:
 * 1. Files older than CLEANUP_TIMEOUT_HOURS (default: 24 hours) that haven't been cleaned up
 * 2. All files that have been successfully downloaded (marked in metadata)
 * 
 * Note: This is the ONLY cleanup mechanism - no manual cleanup from UI
 */
export async function cleanupOrphanedPullFiles() {
    logger.info('[CleanupJob] Starting cleanup of pull files and logs...');
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - CLEANUP_TIMEOUT_HOURS);
    
    try {
        // Find action logs for pull_file and get_logs that need cleanup:
        // - Files older than timeout that haven't been cleaned up (orphaned)
        // - OR files that have been downloaded but not yet cleaned up
        const orphanedLogs = await prisma.deviceActionLog.findMany({
            where: {
                actionType: { in: ['pull_file', 'get_logs'] },
                status: 'success',
                OR: [
                    // Orphaned files (old and not cleaned up)
                    {
                        AND: [
                            { metadata: { path: ['cleanedUp'], equals: false } },
                            { initiatedAt: { lt: cutoffTime } }
                        ]
                    },
                    {
                        AND: [
                            { metadata: { path: ['cleanedUp'], equals: Prisma.JsonNull } },
                            { initiatedAt: { lt: cutoffTime } }
                        ]
                    },
                    // Files that have been downloaded (check metadata for download indicator)
                    // This allows cleanup of files that were downloaded but cleanup failed
                    {
                        metadata: { path: ['downloaded'], equals: true }
                    }
                ],
            },
            select: {
                id: true,
                deviceId: true,
                metadata: true,
                initiatedAt: true
            },
            take: 100 // Process in batches
        });
        
        logger.info(`[CleanupJob] Found ${orphanedLogs.length} orphaned files to cleanup`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const log of orphanedLogs) {
            try {
                const metadata = log.metadata as any;
                const objectPath = metadata?.objectPath;
                
                if (!objectPath) {
                    logger.warn(`[CleanupJob] No objectPath in log ${log.id}, skipping`);
                    continue;
                }
                
                // Delete file from GCloud
                await deleteFileFromCloudStorage(objectPath);
                
                // Update action log
                await prisma.deviceActionLog.update({
                    where: { id: log.id },
                    data: {
                        metadata: {
                            ...metadata,
                            cleanedUp: true,
                            cleanedUpAt: new Date().toISOString(),
                            cleanupReason: 'scheduled'
                        }
                    }
                });
                
                successCount++;
                logger.info(`[CleanupJob] Cleaned up file: ${objectPath}`);
                
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                
                // Check if it's a credential error - don't count as failure
                // These will be retried on next run after credentials are refreshed
                const credentialErr = isCredentialError(error);
                
                if (!credentialErr) {
                    errorCount++;
                }
                
                logger.error(`[CleanupJob] Failed to cleanup log ${log.id}:`, {
                    error: errorMessage,
                    logId: log.id,
                    isCredentialError: credentialErr,
                    willRetry: credentialErr
                });
                
                // Update log with error but don't mark as cleaned
                await prisma.deviceActionLog.update({
                    where: { id: log.id },
                    data: {
                        metadata: {
                            ...(log.metadata as any),
                            cleanupError: errorMessage,
                            cleanupAttemptedAt: new Date().toISOString(),
                            credentialError: credentialErr
                        }
                    }
                });
            }
        }
        
        logger.info(`[CleanupJob] Cleanup complete: ${successCount} succeeded, ${errorCount} failed`);
        
        return {
            success: true,
            processed: orphanedLogs.length,
            succeeded: successCount,
            failed: errorCount
        };
        
    } catch (error) {
        logger.error('[CleanupJob] Error during cleanup:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        throw error;
    }
}

