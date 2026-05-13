import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { registerWaveTimeout } from '$lib/server/scheduler/bundleTimeoutManager';
import type { UserInfo } from '$lib/server/types/user';
import { assertBundleWaveInstallAllowed } from '$lib/server/resources/resourceInstallAccess';

/**
 * POST /api/v2/bundles/[id]/waves/[waveId]/start
 * Start a bundle wave
 * 
 * This endpoint:
 * - Changes wave status from PENDING to IN_PROGRESS
 * - Sets startTime
 * - Sends install commands to all devices in the wave
 * - Registers wave for timeout tracking
 * 
 * Restrictions:
 * - Wave must be in PENDING status
 * - Wave must belong to the specified bundle
 */
export const POST = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId, waveId } = params;

    // Ensure wave belongs to bundle
    const wave = await prisma.bundleWave.findFirst({
      where: { id: waveId, bundleId }
    });

    if (!wave) {
      throw Object.assign(
        new Error('Wave not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    if (wave.status !== 'PENDING') {
      throw Object.assign(
        new Error(`Wave is already ${wave.status}`),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    const [bundle, progresses] = await Promise.all([
      prisma.bundle.findUnique({
        where: { id: bundleId },
        include: {
          apps: { select: { resourceId: true } }
        }
      }),
      prisma.bundleDeviceProgress.findMany({
        where: { bundleId, waveId },
        include: { bundleDevice: true },
        orderBy: { createdAt: 'asc' } // Ensure devices are processed in assignment order
      })
    ]);

    await assertBundleWaveInstallAllowed(
      prisma,
      bundle?.accountId,
      bundle?.apps || [],
      progresses
    );

    const updated = await prisma.bundleWave.update({
      where: { id: waveId },
      data: {
        status: 'IN_PROGRESS',
        startTime: new Date(),
        updatedBy: session.user.id
      },
      select: { id: true, status: true, startTime: true }
    });

    // Send install command to each device assigned to this wave
    try {
      // Set startedAt for all devices in the wave when sending commands
      const startTime = new Date();
      await prisma.bundleDeviceProgress.updateMany({
        where: { bundleId, waveId, status: 'PENDING' },
        data: {
          startedAt: startTime,
          status: 'IN_PROGRESS',
          updatedBy: session.user.id
        }
      });

      for (const prog of progresses) {
        const deviceId = prog.bundleDevice.deviceId;
        const command = {
          type: 'bundle_install',
          sessionId: `wave:${waveId}`,
          batchId: `wave:${waveId}`,
          deviceId,
          bundles: [
            { id: bundle?.id ?? bundleId, name: bundle?.name ?? 'Bundle', order: 1 }
          ],
          options: { reboot: false, autoOpen: false }
        };

        // Use publisher to send message
        const routing = MessageFactory.createSystemMessage(
          'device:actionRequest',
          `subscription:device:${deviceId}`,
          command,
          {
            id: session.user.id,
            email: session.user.email,
            name: session.user.email, // Use email as fallback for name
            systemRole: session.user.systemRole,
            source: 'session'
          } satisfies UserInfo,
          { echoToSender: false }
        );
        await publisher.publish(routing);
      }

      logger.info(`Dispatched bundle_install to ${progresses.length} devices for wave ${waveId}`);
    } catch (dispatchErr: any) {
      logger.warn(
        `Failed dispatching devices for wave ${waveId}: ${dispatchErr?.message || String(dispatchErr)}`
      );
    }

    // Register wave for timeout tracking
    try {
      await registerWaveTimeout(waveId, bundleId, new Date());
      logger.info(`Registered wave ${waveId} for timeout tracking`);
    } catch (timeoutErr: any) {
      logger.warn(
        `Failed to register wave for timeout tracking: ${String(timeoutErr?.message || timeoutErr)}`
      );
    }

    return successResponse(
      { wave: updated },
      { message: 'Wave started successfully' }
    );
  },
  { permission: 'bundle.publish' }
);
