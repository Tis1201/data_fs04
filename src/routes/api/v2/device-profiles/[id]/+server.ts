import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * GET /api/v2/device-profiles/[id]
 * Get a device profile by ID with settings and assignments
 * 
 * Admin: Full access to any profile
 * User: Access only to profiles from their accounts
 */
export const GET = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id } = params;

    // Get device profile with settings and assignments
    const profile = await prisma.deviceProfile.findUnique({
      where: { id },
      include: {
        settings: {
          orderBy: { order: 'asc' }
        },
        assignments: {
          include: {
            device: {
              select: {
                id: true,
                name: true,
                deviceType: true,
                status: true
              }
            }
          }
        },
        account: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            assignments: true
          }
        }
      }
    });

    if (!profile) {
      throw Object.assign(
        new Error('Device profile not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Check access for non-admin users
    if (session.user.systemRole !== 'ADMIN') {
      const hasAccess = await prisma.accountMembership.findFirst({
        where: {
          accountId: profile.accountId,
          userId: session.user.id
        }
      });

      if (!hasAccess) {
        throw Object.assign(
          new Error('Access denied to this profile'),
          { status: 403, code: ErrorCodes.FORBIDDEN }
        );
      }
    }

    return successResponse({ profile });
  },
  { permission: 'deviceProfile.view' }
);

/**
 * PUT /api/v2/device-profiles/[id]
 * Update a device profile
 * 
 * Body:
 * - name: string (required)
 * - description: string (optional)
 * - settings: array (required)
 * 
 * Admin: Can update any profile
 * User: Can update profiles from their accounts (OWNER/ADMIN/MEMBER role)
 * 
 * Auto-reapply: After update, automatically reapplies to all assigned active devices
 */
export const PUT = unifiedEndpoint(
  async ({ context, params, event }) => {
    const { prisma, session } = context;
    const { id } = params;
    const body = await event.request.json();
    const { name, description, settings } = body;

    // Validate required fields
    if (!name || !settings || !Array.isArray(settings)) {
      throw Object.assign(
        new Error('Name and settings are required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Check if profile exists
    const existingProfile = await prisma.deviceProfile.findUnique({
      where: { id },
      select: {
        id: true,
        accountId: true,
        createdBy: true
      }
    });

    if (!existingProfile) {
      throw Object.assign(
        new Error('Device profile not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Check permissions for non-admin users
    if (session.user.systemRole !== 'ADMIN') {
      const hasAccess = await prisma.accountMembership.findFirst({
        where: {
          accountId: existingProfile.accountId,
          userId: session.user.id,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
        }
      });

      if (!hasAccess) {
        throw Object.assign(
          new Error('Access denied to update this profile'),
          { status: 403, code: ErrorCodes.FORBIDDEN }
        );
      }
    }

    // Update profile and settings in a transaction
    const updatedProfile = await prisma.$transaction(async (tx: any) => {
      // Update profile
      await tx.deviceProfile.update({
        where: { id },
        data: {
          name,
          description,
          updatedBy: session.user.id
        }
      });

      // Get existing settings for audit log before deletion
      const existingSettings = await tx.deviceProfileSetting.findMany({
        where: { profileId: id }
      });

      // Delete existing settings
      await tx.deviceProfileSetting.deleteMany({
        where: { profileId: id }
      });

      // Log audit for deleted settings
      for (const setting of existingSettings) {
        await logAudit({
          actionType: AuditActionType.DELETE,
          tableName: 'DeviceProfileSetting',
          recordId: setting.id,
          oldData: setting,
          newData: null,
          userId: session.user.id,
          ipAddress: context.ipAddress,
          prisma: tx
        });
      }

      // Create new settings
      await tx.deviceProfileSetting.createMany({
        data: settings.map((setting: any, index: number) => ({
          profileId: id,
          key: setting.key,
          value: setting.value,
          dataType: setting.dataType,
          label: setting.label,
          category: setting.category,
          order: setting.order ?? index
        }))
      });

      // Get created settings for audit log
      const createdSettings = await tx.deviceProfileSetting.findMany({
        where: { profileId: id }
      });

      // Log audit for created settings
      for (const setting of createdSettings) {
        await logAudit({
          actionType: AuditActionType.INSERT,
          tableName: 'DeviceProfileSetting',
          recordId: setting.id,
          oldData: null,
          newData: setting,
          userId: session.user.id,
          ipAddress: context.ipAddress,
          prisma: tx
        });
      }

      // Return updated profile with settings
      return await tx.deviceProfile.findUnique({
        where: { id },
        include: {
          settings: {
            orderBy: { order: 'asc' }
          },
          account: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
    });

    const deletedOverrides = await prisma.deviceProfileOverride.deleteMany({
      where: { globalProfileId: id }
    });
    if (deletedOverrides.count > 0) {
      logger.info(`Cleared ${deletedOverrides.count} device override(s) for profile ${id}`);
    }

    // Auto-reapply to all assigned devices after profile update
    try {
      // Get all devices assigned to this profile
      const assignedDevices = await prisma.device.findMany({
        where: {
          profileAssignment: {
            profileId: id
          },
          status: 'ACTIVE'
        },
        select: { id: true, name: true }
      });

      if (updatedProfile?.isActive && assignedDevices.length > 0) {
        logger.info(`Auto-reapplying profile ${id} to ${assignedDevices.length} assigned devices`);

        // Import messaging services
        const { publisher } = await import('$lib/server/messaging/core/publisher');
        const { MessageFactory } = await import('$lib/server/messaging/interfaces/message');
        const { SystemUser } = await import('$lib/server/messaging/interfaces/message');

        // Update DeviceProfileAssignment records to APPLYING status
        await prisma.deviceProfileAssignment.updateMany({
          where: {
            deviceId: { in: assignedDevices.map((d: { id: string }) => d.id) },
            profileId: id
          },
          data: {
            status: 'APPLYING',
            lastSyncAt: new Date()
          }
        });

        // Send reapply messages to each device
        for (const device of assignedDevices) {
          try {
            const routingMessage = MessageFactory.createSystemMessage(
              'device:actionRequest',
              `subscription:device:${device.id}`,
              {
                action: 'applyProfile',
                deviceId: device.id,
                profileId: id,
                message: 'Profile updated - reapplication requested',
                sentAt: new Date().toISOString()
              },
              SystemUser,
              { echoToSender: false }
            );

            await publisher.publish(routingMessage);
            logger.info(`Auto-reapply message sent to device ${device.id}`);

            // Set timeout for auto-reapply
            setTimeout(async () => {
              try {
                const assignment = await prisma.deviceProfileAssignment.findFirst({
                  where: {
                    deviceId: device.id,
                    profileId: id,
                    status: 'APPLYING'
                  }
                });

                if (assignment) {
                  await prisma.deviceProfileAssignment.update({
                    where: { id: assignment.id },
                    data: {
                      status: 'FAILED',
                      lastSyncAt: new Date()
                    }
                  });

                  logger.warn(`Auto-reapply timed out for device ${device.id}`, {
                    deviceId: device.id,
                    profileId: id,
                    status: 'FAILED'
                  });

                  // Send timeout notification
                  try {
                    const timeoutMessage = MessageFactory.createSystemMessage(
                      'device:profileUpdate',
                      `subscription:device:${device.id}`,
                      {
                        action: 'applyProfile',
                        deviceId: device.id,
                        status: 'failed',
                        profileId: id,
                        message: 'Auto-reapply timed out after 3 minutes',
                        sentAt: new Date().toISOString()
                      },
                      SystemUser,
                      { echoToSender: false }
                    );

                    await publisher.publish(timeoutMessage);
                  } catch (notificationError) {
                    logger.error(`Error sending auto-reapply timeout notification: ${String(notificationError)}`);
                  }
                }
              } catch (timeoutError) {
                logger.error(`Error updating auto-reapply timeout status: ${String(timeoutError)}`);
              }
            }, 3 * 60 * 1000); // 3 minutes timeout
          } catch (error) {
            logger.error(`Failed to send auto-reapply message to device ${device.id}: ${String(error)}`);
          }
        }

        // Send real-time notification to UI about auto-reapply
        try {
          const uiNotification = MessageFactory.createSystemMessage(
            'device:profileUpdate',
            `subscription:profile:${id}`,
            {
              action: 'applyProfile',
              profileId: id,
              message: `Profile updated - reapplying to ${assignedDevices.length} devices`,
              sentAt: new Date().toISOString(),
              autoReapply: true,
              deviceCount: assignedDevices.length,
              deviceIds: assignedDevices.map((d: { id: string }) => d.id)
            },
            SystemUser,
            { echoToSender: false }
          );

          await publisher.publish(uiNotification);
          logger.info(`UI notification sent for profile ${id} auto-reapply`);
        } catch (uiError) {
          logger.error(`Failed to send auto-reapply UI notification: ${String(uiError)}`);
        }
      }
    } catch (autoReapplyError) {
      logger.error(`Error during auto-reapply: ${String(autoReapplyError)}`);
      // Don't fail the profile update if auto-reapply fails
    }

    return successResponse(
      { profile: updatedProfile },
      { message: 'Device profile updated successfully' }
    );
  },
  { permission: 'deviceProfile.edit' }
);

/**
 * DELETE /api/v2/device-profiles/[id]
 * Delete a device profile
 * 
 * Admin: Can delete any profile (without assignments)
 * User: Can delete profiles from their accounts (OWNER/ADMIN/MEMBER role)
 * 
 * Note: Cannot delete profiles with active device assignments
 */
export const DELETE = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id } = params;

    // Check if profile exists
    const existingProfile = await prisma.deviceProfile.findUnique({
      where: { id },
      select: {
        id: true,
        accountId: true,
        _count: {
          select: {
            assignments: true
          }
        }
      }
    });

    if (!existingProfile) {
      throw Object.assign(
        new Error('Device profile not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    // Check permissions for non-admin users
    if (session.user.systemRole !== 'ADMIN') {
      const hasAccess = await prisma.accountMembership.findFirst({
        where: {
          accountId: existingProfile.accountId,
          userId: session.user.id,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
        }
      });

      if (!hasAccess) {
        throw Object.assign(
          new Error('Access denied to delete this profile'),
          { status: 403, code: ErrorCodes.FORBIDDEN }
        );
      }
    }

    // Check if profile has active assignments
    if (existingProfile._count.assignments > 0) {
      throw Object.assign(
        new Error(
          'Cannot delete profile with active device assignments. Please remove all assignments first.'
        ),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    // Delete profile (cascade will handle settings)
    await prisma.deviceProfile.delete({
      where: { id }
    });

    return successResponse(
      { profileId: id },
      { message: 'Device profile deleted successfully' }
    );
  },
  { permission: 'deviceProfile.delete' }
);
