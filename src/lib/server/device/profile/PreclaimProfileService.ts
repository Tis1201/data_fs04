/**
 * PreclaimProfileService
 * 
 * Handles automatic profile assignment for devices claimed via preclaim.
 * Orchestrates profile assignment and config delivery during device registration.
 */

import { logger } from '$lib/server/logger';
import { DeviceProfileService } from './DeviceProfileService';
import { ProfileMessagingService } from './ProfileMessagingService';
import { ProfileConfigBuilder } from './ProfileConfigBuilder';

export interface ApplyPreclaimProfileResult {
    success: boolean;
    profileId: string | null;
    logId: string | null;
    error?: string;
}

export class PreclaimProfileService {
    private deviceProfileService: DeviceProfileService;
    private messagingService: ProfileMessagingService;
    private configBuilder: ProfileConfigBuilder;

    constructor(private prisma: any) {
        this.deviceProfileService = new DeviceProfileService(prisma);
        this.messagingService = new ProfileMessagingService(prisma);
        this.configBuilder = new ProfileConfigBuilder(prisma);
    }

    /**
     * Apply preclaim profile to newly claimed device
     * 
     * Flow:
     * 1. Fetch preclaim set and assigned profile
     * 2. Assign global profile to device (no copy)
     * 3. Send config to device with action log
     * 
     * @param deviceId - Device ID that was just claimed
     * @param preclaimSetId - Preclaim set ID
     * @param userId - User who claimed the device
     * @param options - Optional configuration
     * @returns Result with profileId and logId
     */
    async applyToDevice(
        deviceId: string,
        preclaimSetId: string,
        userId: string,
        options?: {
            delay?: number; // Delay before sending config (for Pushpin timing)
        }
    ): Promise<ApplyPreclaimProfileResult> {
        try {
            // 1. Get preclaim set with assigned profile
            const preclaimSet = await this.prisma.preclaimSet.findUnique({
                where: { id: preclaimSetId },
                include: {
                    profile: {
                        include: {
                            settings: {
                                orderBy: { order: 'asc' }
                            }
                        }
                    }
                }
            });

            if (!preclaimSet) {
                logger.warn(`[PreclaimProfile] Preclaim set ${preclaimSetId} not found`);
                return {
                    success: false,
                    profileId: null,
                    logId: null,
                    error: 'Preclaim set not found'
                };
            }

            if (!preclaimSet.profileId || !preclaimSet.profile) {
                logger.debug(`[PreclaimProfile] No profile assigned to preclaim set ${preclaimSetId}`);
                return {
                    success: true, // Not an error - just no profile assigned
                    profileId: null,
                    logId: null
                };
            }

            const globalProfile = preclaimSet.profile;

            logger.info(`[PreclaimProfile] Applying profile ${globalProfile.id} to device ${deviceId}`, {
                deviceId,
                profileId: globalProfile.id,
                profileName: globalProfile.name,
                preclaimSetId
            });

            // 2. Assign global profile to device (no copy)
            const assignmentResult = await this.deviceProfileService.assignProfile(
                deviceId,
                globalProfile.id,
                userId
            );

            if (!assignmentResult.success) {
                logger.error(`[PreclaimProfile] Failed to assign profile to device ${deviceId}:`, {
                    error: assignmentResult.error,
                    deviceId,
                    profileId: globalProfile.id
                } as any);
                return {
                    success: false,
                    profileId: globalProfile.id,
                    logId: null,
                    error: assignmentResult.error
                };
            }

            // 3. Update assignment status to APPLYING (waiting for device confirmation)
            await this.prisma.deviceProfileAssignment.update({
                where: { deviceId: deviceId },
                data: {
                    status: 'APPLYING'
                }
            });

            // 4. Build config from global profile
            const config = this.configBuilder.buildFromGlobal(globalProfile);

            // 5. Send config to device with action log
            const sendResult = await this.messagingService.sendConfigToDevice(
                deviceId,
                config,
                globalProfile.id,
                {
                    userId: userId,
                    delay: options?.delay
                }
            );

            if (!sendResult.success) {
                logger.error(`[PreclaimProfile] Failed to send config to device ${deviceId}:`, {
                    error: sendResult.error,
                    deviceId,
                    profileId: globalProfile.id
                } as any);
                // Don't fail the operation - device can receive config later
            }

            logger.info(`[PreclaimProfile] Profile successfully applied to device ${deviceId}`, {
                deviceId,
                profileId: globalProfile.id,
                logId: sendResult.logId,
                assignmentId: assignmentResult.assignmentId
            });

            return {
                success: true,
                profileId: globalProfile.id,
                logId: sendResult.logId
            };

        } catch (error) {
            logger.error(`[PreclaimProfile] Error applying profile to device ${deviceId}:`, error as any);
            return {
                success: false,
                profileId: null,
                logId: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Apply profile and send config immediately (for already-connected devices)
     * 
     * @param deviceId - Device ID
     * @param profileId - Global profile ID
     * @param userId - User assigning the profile
     * @returns Result with logId
     */
    async assignAndSend(
        deviceId: string,
        profileId: string,
        userId: string
    ): Promise<ApplyPreclaimProfileResult> {
        try {
            // 1. Get global profile
            const globalProfile = await this.prisma.deviceProfile.findUnique({
                where: { id: profileId },
                include: {
                    settings: {
                        orderBy: { order: 'asc' }
                    }
                }
            });

            if (!globalProfile) {
                return {
                    success: false,
                    profileId: null,
                    logId: null,
                    error: 'Profile not found'
                };
            }

            // 2. Assign profile
            const assignmentResult = await this.deviceProfileService.assignProfile(
                deviceId,
                profileId,
                userId
            );

            if (!assignmentResult.success) {
                return {
                    success: false,
                    profileId: profileId,
                    logId: null,
                    error: assignmentResult.error
                };
            }

            // 3. Update status to APPLYING
            await this.prisma.deviceProfileAssignment.update({
                where: { deviceId: deviceId },
                data: { status: 'APPLYING' }
            });

            // 4. Build and send config
            const config = this.configBuilder.buildFromGlobal(globalProfile);
            const sendResult = await this.messagingService.sendConfigToDevice(
                deviceId,
                config,
                profileId,
                { userId }
            );

            logger.info(`[PreclaimProfile] Profile assigned and sent to device ${deviceId}`, {
                deviceId,
                profileId,
                logId: sendResult.logId
            });

            return {
                success: true,
                profileId: profileId,
                logId: sendResult.logId
            };

        } catch (error) {
            logger.error(`[PreclaimProfile] Error in assignAndSend:`, error as any);
            return {
                success: false,
                profileId: null,
                logId: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

