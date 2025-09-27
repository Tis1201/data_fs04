import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { sseService } from '$lib/server/sse/sseService';

export const POST: RequestHandler = restrict(
  async ({ params, locals }) => {
    const { id: bundleId, waveId } = params as { id: string; waveId: string };
    try {
      // Auth context
      const auth = await locals.auth.validate();
      if (!auth?.user) {
        return json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }

      // Ensure wave belongs to bundle
      const wave = await locals.prisma.bundleWave.findFirst({ where: { id: waveId, bundleId } });
      if (!wave) {
        return json({ success: false, error: 'Wave not found' }, { status: 404 });
      }

      if (wave.status !== 'PENDING') {
        return json({ success: false, error: `Wave is already ${wave.status}` }, { status: 400 });
      }

      // Mark wave as IN_PROGRESS
      const updated = await locals.prisma.bundleWave.update({
        where: { id: waveId },
        data: {
          status: 'IN_PROGRESS',
          startTime: new Date(),
          updatedBy: auth.user.id
        },
        select: { id: true, status: true, startTime: true }
      });

      // Send install command to each device assigned to this wave
      try {
        const [bundle, progresses] = await Promise.all([
          locals.prisma.bundle.findUnique({ where: { id: bundleId }, select: { id: true, name: true } }),
          locals.prisma.bundleDeviceProgress.findMany({
            where: { bundleId, waveId },
            include: { bundleDevice: true },
            orderBy: { createdAt: 'asc' } // Ensure devices are processed in assignment order
          })
        ]);

        // Set startedAt for all devices in the wave when sending commands
        const startTime = new Date();
        await locals.prisma.bundleDeviceProgress.updateMany({
          where: { bundleId, waveId, status: 'PENDING' },
          data: { 
            startedAt: startTime,
            status: 'IN_PROGRESS',
            updatedBy: auth.user.id
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
          await sseService.sendToDevice(deviceId, {
            type: 'device',
            scope: `subscription:device:${deviceId}`,
            payload: command
          });
        }
        logger.info(`Dispatched bundle_install to ${progresses.length} devices for wave ${waveId}`);
      } catch (dispatchErr: any) {
        logger.warn(`Failed dispatching devices for wave ${waveId}: ${dispatchErr?.message || String(dispatchErr)}`);
      }

      logger.info(`Wave ${waveId} for bundle ${bundleId} started by ${auth.user.id}`);
      return json({ success: true, data: updated });
    } catch (err) {
      logger.error(`Failed to start wave ${waveId} for bundle ${bundleId}: ${err instanceof Error ? err.message : String(err)}`);
      return json({ success: false, error: 'Failed to start wave' }, { status: 500 });
    }
  },
  [SystemRole.ADMIN]
);


