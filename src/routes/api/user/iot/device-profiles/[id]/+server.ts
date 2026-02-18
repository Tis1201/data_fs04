import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get device profile with settings and assignments
    const profile = await locals.prisma.deviceProfile.findUnique({
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
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    // Verify profile belongs to current account
    const currentAccountId = (locals as any).currentAccount?.account?.id;
    if (currentAccountId && profile.accountId !== currentAccountId) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    if (!currentAccountId) {
      const hasAccess = await locals.prisma.accountMembership.findFirst({
        where: { accountId: profile.accountId, userId: auth.user.id }
      });
      if (!hasAccess) {
        return json({ error: 'Access denied' }, { status: 403 });
      }
    }

    return json({
      success: true,
      profile
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, settings } = body;

    // Validate required fields
    if (!name || !settings || !Array.isArray(settings)) {
      return json({ error: 'Name and settings are required' }, { status: 400 });
    }

    // Check if profile exists and user has access
    const existingProfile = await locals.prisma.deviceProfile.findUnique({
      where: { id },
      select: { 
        id: true, 
        accountId: true,
        createdBy: true
      }
    });

    if (!existingProfile) {
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    const currentAccountId = (locals as any).currentAccount?.account?.id;
    if (currentAccountId && existingProfile.accountId !== currentAccountId) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    if (!currentAccountId) {
      const hasAccess = await locals.prisma.accountMembership.findFirst({
        where: {
          accountId: existingProfile.accountId,
          userId: auth.user.id,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
        }
      });
      if (!hasAccess) {
        return json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Update profile and settings in a transaction
    const updatedProfile = await locals.prisma.$transaction(async (tx) => {
      // Update profile
      const profile = await tx.deviceProfile.update({
        where: { id },
        data: {
          name,
          description,
          updatedBy: auth.user.id
        }
      });

      // Delete existing settings
      await tx.deviceProfileSetting.deleteMany({
        where: { profileId: id }
      });

      // Create new settings
      await tx.deviceProfileSetting.createMany({
        data: settings.map((setting: any, index: number) => ({
          profileId: id,
          key: setting.key,
          value: setting.value,
          dataType: setting.dataType,
          label: setting.label,
          category: setting.category,
          order: setting.order || index
        }))
      });

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
          },
        }
      });
    });

    // Auto-reapply to all assigned devices after profile update
    logger.info(`[DEBUG] Starting auto-reapply check for profile ${id}`);
    
    try {
      // Get all devices assigned to this profile
      logger.info(`[DEBUG] Querying for devices assigned to profile ${id}`);
      const assignedDevices = await locals.prisma.device.findMany({
        where: {
          profileAssignment: {
            profileId: id
          },
          status: 'ACTIVE'
        },
        select: { id: true, name: true }
      });

      logger.info(`[DEBUG] Found ${assignedDevices.length} assigned devices:`, {
        profileId: id,
        deviceCount: assignedDevices.length,
        deviceIds: assignedDevices.map(d => d.id)
      });

      if (assignedDevices.length > 0) {
        logger.info(`[DEBUG] Auto-reapplying profile ${id} to ${assignedDevices.length} assigned devices`);
        
        // Import reapply functionality
        const { publisher } = await import('$lib/server/messaging/core/publisher');
        const { MessageFactory } = await import('$lib/server/messaging/interfaces/message');
        const { SystemUser } = await import('$lib/server/messaging/interfaces/message');

        // Update DeviceProfileAssignment records to APPLYING status
        await locals.prisma.deviceProfileAssignment.updateMany({
          where: {
            deviceId: { in: assignedDevices.map(d => d.id) },
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

            // Set timeout for auto-reapply (same as manual reapply)
            setTimeout(async () => {
              try {
                const assignment = await locals.prisma.deviceProfileAssignment.findFirst({
                  where: {
                    deviceId: device.id,
                    profileId: id,
                    status: 'APPLYING'
                  }
                });

                if (assignment) {
                  await locals.prisma.deviceProfileAssignment.update({
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

                  // Send timeout notification to UI
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
                    logger.info(`Auto-reapply timeout notification sent for device ${device.id}`);
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
        logger.info(`[DEBUG] Sending UI notification for auto-reapply`);
        try {
          // Send to a profile-specific scope that the web UI can subscribe to
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
              deviceIds: assignedDevices.map(d => d.id)
            },
            SystemUser,
            { echoToSender: false }
          );

          logger.info(`[DEBUG] Publishing UI notification for profile ${id}`, {
            messageId: uiNotification.id,
            scope: uiNotification.scope,
            profileId: id,
            deviceCount: assignedDevices.length
          });

          await publisher.publish(uiNotification);
          logger.info(`[DEBUG] UI notification sent for profile ${id}`);
        } catch (uiError) {
          logger.error(`[DEBUG] Failed to send auto-reapply UI notification: ${String(uiError)}`);
        }
      }
    } catch (autoReapplyError) {
      logger.error(`Error during auto-reapply: ${String(autoReapplyError)}`);
      // Don't fail the profile update if auto-reapply fails
    }

    return json({
      success: true,
      profile: updatedProfile
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Check if profile exists and user has access
    const existingProfile = await locals.prisma.deviceProfile.findUnique({
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
      return json({ error: 'Device profile not found' }, { status: 404 });
    }

    const currentAccountId = (locals as any).currentAccount?.account?.id;
    if (currentAccountId && existingProfile.accountId !== currentAccountId) {
      return json({ error: 'Access denied' }, { status: 403 });
    }

    if (!currentAccountId) {
      const hasAccess = await locals.prisma.accountMembership.findFirst({
        where: {
          accountId: existingProfile.accountId,
          userId: auth.user.id,
          role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
        }
      });
      if (!hasAccess) {
        return json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Check if profile has active assignments
    if (existingProfile._count.assignments > 0) {
      return json({ 
        error: 'Cannot delete profile with active device assignments. Please remove all assignments first.' 
      }, { status: 400 });
    }

    // Delete profile (cascade will handle settings and assignments)
    await locals.prisma.deviceProfile.delete({
      where: { id }
    });

    return json({
      success: true,
      message: 'Device profile deleted successfully'
    });

  } catch (error) {
    return errorHandler(error);
  }
};
