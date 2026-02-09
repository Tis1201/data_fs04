import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';

/**
 * Calculate the active period end date for a bundle
 * @param bundleId - The bundle ID
 * @param bundleData - Optional bundle data to avoid extra query
 * @returns Active period end date, or null if bundle not found or never started
 */
export async function calculateActivePeriodEnd(
  bundleId: string,
  bundleData?: { scheduledAt: Date | null; activePeriodDays: number | null }
): Promise<Date | null> {
  try {
    // Use provided bundle data or fetch it
    let bundle = bundleData;
    if (!bundle) {
      bundle = await (prisma as any).bundle.findUnique({
        where: { id: bundleId },
        select: { scheduledAt: true, activePeriodDays: true }
      });
    }

    if (!bundle) {
      return null;
    }

    // Get actual start time (first wave's startTime - when deployment actually began)
    const firstWave = await (prisma as any).bundleWave.findFirst({
      where: { bundleId },
      orderBy: { startTime: 'asc' },
      select: { startTime: true }
    });

    const actualStartTime = firstWave?.startTime || bundle.scheduledAt;
    const activePeriodDays = bundle.activePeriodDays ?? 1; // Default to 1 day

    if (!actualStartTime) {
      return null;
    }

    return new Date(
      actualStartTime.getTime() + (activePeriodDays * 24 * 60 * 60 * 1000)
    );
  } catch (error) {
    logger.warn(
      `[BundleEventHelpers] Failed to calculate active period for bundle ${bundleId}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Check if an event timestamp is within the bundle's active period
 * @param bundleId - The bundle ID
 * @param eventTimestamp - The event timestamp to check
 * @param bundleData - Optional bundle data to avoid extra query
 * @returns true if within active period, false otherwise
 */
export async function isWithinActivePeriod(
  bundleId: string,
  eventTimestamp: Date | string,
  bundleData?: { scheduledAt: Date | null; activePeriodDays: number | null }
): Promise<boolean> {
  const activePeriodEnd = await calculateActivePeriodEnd(bundleId, bundleData);
  if (!activePeriodEnd) {
    return false;
  }

  const eventDate = typeof eventTimestamp === 'string' ? new Date(eventTimestamp) : eventTimestamp;
  return eventDate <= activePeriodEnd;
}

/**
 * Find device progress record using multiple approaches for robustness
 * @param bundleId - The bundle ID
 * @param deviceId - The device ID
 * @param waveId - The wave ID
 * @returns Device progress record or null if not found
 */
export async function findDeviceProgress(
  bundleId: string,
  deviceId: string,
  waveId: string
): Promise<{
  progress: any;
  bundleDevice: any;
} | null> {
  logger.info(`[BundleEventHelpers] Looking for device progress: deviceId=${deviceId}, bundleId=${bundleId}, waveId=${waveId}`);

  // Approach 1: Find by waveId and deviceId via bundleDevice relation (most reliable)
  let deviceProgress = await (prisma as any).bundleDeviceProgress.findFirst({
    where: {
      waveId,
      bundleDevice: { deviceId, bundleId }
    },
    select: {
      id: true,
      waveId: true,
      status: true,
      metadata: true,
      createdAt: true,
      bundleDeviceId: true
    }
  });

  if (deviceProgress) {
    logger.info(`[BundleEventHelpers] Found device progress via Approach 1: progressId=${deviceProgress.id}, bundleDeviceId=${deviceProgress.bundleDeviceId}`);
    // Fetch bundleDevice for return
    const bundleDevice = await (prisma as any).bundleDevice.findUnique({
      where: { id: deviceProgress.bundleDeviceId },
      select: { id: true, deviceId: true, bundleId: true, status: true }
    });
    return { progress: deviceProgress, bundleDevice: bundleDevice || null };
  }

  logger.debug(`[BundleEventHelpers] Approach 1 failed: No progress found via waveId+deviceId relation`);

  // Approach 2: If not found, try finding bundleDevice first, then progress
  logger.debug(`[BundleEventHelpers] Trying Approach 2: Finding bundleDevice first`);
  const bundleDevice = await (prisma as any).bundleDevice.findFirst({
    where: { bundleId, deviceId },
    select: { id: true, deviceId: true, bundleId: true, status: true }
  });

  if (!bundleDevice) {
    logger.warn(`[BundleEventHelpers] No bundleDevice found. Searching for similar devices in bundle...`);

    const allBundleDevices = await (prisma as any).bundleDevice.findMany({
      where: { bundleId },
      select: { id: true, deviceId: true, status: true },
      take: 10
    });

    logger.warn(
      `[BundleEventHelpers] Bundle ${bundleId} has ${allBundleDevices.length} devices (showing first 10): ${JSON.stringify(
        allBundleDevices.map((bd: any) => ({ id: bd.id, deviceId: bd.deviceId, status: bd.status }))
      )}`
    );

    const deviceInAnyBundle = await (prisma as any).bundleDevice.findFirst({
      where: { deviceId },
      select: { id: true, deviceId: true, bundleId: true },
      take: 5
    });

    if (deviceInAnyBundle) {
      logger.warn(
        `[BundleEventHelpers] Device ${deviceId} exists in bundle ${deviceInAnyBundle.bundleId}, but not in target bundle ${bundleId}`
      );
    } else {
      logger.warn(`[BundleEventHelpers] Device ${deviceId} not found in any bundle`);
    }

    return null;
  }

  logger.info(
    `[BundleEventHelpers] Found bundleDevice: id=${bundleDevice.id}, deviceId=${bundleDevice.deviceId}, bundleId=${bundleDevice.bundleId}, status=${bundleDevice.status}`
  );

  deviceProgress = await (prisma as any).bundleDeviceProgress.findFirst({
    where: {
      bundleId,
      bundleDeviceId: bundleDevice.id,
      waveId // Also check waveId matches
    },
    select: {
      id: true,
      waveId: true,
      status: true,
      metadata: true,
      createdAt: true,
      bundleDeviceId: true
    }
  });

  if (deviceProgress) {
    logger.info(`[BundleEventHelpers] Found device progress via Approach 2: progressId=${deviceProgress.id}, waveId=${deviceProgress.waveId}`);
    return { progress: deviceProgress, bundleDevice };
  }

  logger.warn(
    `[BundleEventHelpers] BundleDevice found but no progress record for waveId=${waveId}. Checking all progress records for this bundleDevice...`
  );

  // Debug: Check all progress records for this bundleDevice
  const allProgress = await (prisma as any).bundleDeviceProgress.findMany({
    where: {
      bundleId,
      bundleDeviceId: bundleDevice.id
    },
    orderBy: [{ completedAt: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      waveId: true,
      status: true
    }
  });

  logger.warn(
    `[BundleEventHelpers] Found ${allProgress.length} progress records for bundleDevice ${bundleDevice.id}: ${JSON.stringify(
      allProgress.map((p: any) => ({ id: p.id, waveId: p.waveId, status: p.status }))
    )}`
  );

  return null;
}

/**
 * Validate if a wave can accept events (not terminal or within active period)
 * @param bundleId - The bundle ID
 * @param waveId - The wave ID
 * @param waveStatus - The current wave status
 * @param eventTimestamp - Optional event timestamp for active period check
 * @returns Object with canAccept flag and reason
 */
export async function validateWaveCanAcceptEvents(
  bundleId: string,
  waveId: string,
  waveStatus: string,
  eventTimestamp?: Date | string
): Promise<{ canAccept: boolean; reason?: string }> {
  // COMPLETED waves never accept new events
  if (waveStatus === 'COMPLETED') {
    return {
      canAccept: false,
      reason: `Wave ${waveId} is COMPLETED and cannot accept new events`
    };
  }

  // IN_PROGRESS and PENDING waves always accept events
  if (waveStatus === 'IN_PROGRESS' || waveStatus === 'PENDING') {
    return { canAccept: true };
  }

  // For FAILED/CANCELLED waves, check active period
  if (waveStatus === 'FAILED' || waveStatus === 'CANCELLED') {
    if (!eventTimestamp) {
      return {
        canAccept: false,
        reason: `Wave ${waveId} is ${waveStatus} but no event timestamp provided for active period check`
      };
    }

    const withinPeriod = await isWithinActivePeriod(bundleId, eventTimestamp);
    if (!withinPeriod) {
      return {
        canAccept: false,
        reason: `Wave ${waveId} is ${waveStatus} and bundle active period has expired`
      };
    }

    return {
      canAccept: true,
      reason: `Wave ${waveId} is ${waveStatus} but still within active period, accepting late response`
    };
  }

  // Unknown status
  return {
    canAccept: false,
    reason: `Wave ${waveId} has unknown status: ${waveStatus}`
  };
}

/**
 * Get bundle data (scheduledAt, activePeriodDays)
 * @param bundleId - The bundle ID
 * @returns Bundle data or null if not found
 */
export async function getBundleData(bundleId: string): Promise<{
  scheduledAt: Date | null;
  activePeriodDays: number;
} | null> {
  try {
    const bundle = await (prisma as any).bundle.findUnique({
      where: { id: bundleId },
      select: { scheduledAt: true, activePeriodDays: true }
    });

    if (!bundle) {
      return null;
    }

    return {
      scheduledAt: bundle.scheduledAt,
      activePeriodDays: bundle.activePeriodDays ?? 1
    };
  } catch (error) {
    logger.warn(
      `[BundleEventHelpers] Failed to get bundle data for ${bundleId}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

