import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma';
import { publisher } from '$lib/server/messaging/core/publisher';
import { MessageFactory } from '$lib/server/messaging/interfaces/message';
import { SystemUser } from '$lib/server/messaging/interfaces/message';
import { checkAndAutoStartNextWave } from '$lib/server/messaging/handlers/device/bundleUtils';
import type { ClickHouseEvent } from '$lib/server/clickhouse/client';
import { eventDeduplication } from '$lib/server/state/eventDeduplication';
import { getStateManager } from '$lib/server/state/stateManagerFactory';
import { BundleProcessingState } from '$lib/server/state/types';
import crypto from 'crypto';
import {
  calculateActivePeriodEnd,
  isWithinActivePeriod,
  findDeviceProgress,
  validateWaveCanAcceptEvents,
  getBundleData
} from './bundleEventHelpers';
import { compareProgressOrder } from '$lib/bundles/progressOrder';

export type FileStatusEvent = {
  deviceId: string;
  waveId: string; // "wave:<id>" or raw id
  bundleId?: string;
  logId?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING' | string;
  progress?: number;
  message?: string;
  error?: string | null;
  timestamp?: string;
};

export async function processEvent(evt: FileStatusEvent) {
  const deviceId = String(evt.deviceId || '').trim();
  const rawWaveId = String(evt.waveId || '').trim();
  if (!deviceId || !rawWaveId) return;
  const waveId = rawWaveId.startsWith('wave:') ? rawWaveId.slice(5) : rawWaveId;
  let status = normalizeStatus(evt.status);
  const progress = clamp(Number(evt.progress ?? 0), 0, 100);
  const message = evt.message || undefined;
  const bundleId = evt.bundleId || undefined;
  const logId = evt.logId || undefined;

  logger.info(`[BundleEventProcessor] Processing evt device=${deviceId} wave=${waveId} status=${status} progress=${progress}`);

  // If progress has reached 100 and not explicitly failed/cancelled, coerce to COMPLETED
  if (progress === 100 && status !== 'FAILED' && status !== 'CANCELLED') {
    status = 'COMPLETED';
  }

  // Resolve bundleDevice for this bundle/device, then upsert progress
  try {
    if (!bundleId) {
      logger.warn(`[BundleEventProcessor] Missing bundleId for wave=${waveId} device=${deviceId}. Skipping.`);
      return;
    }

    // Find the device progress by looking up bundleDevice first
    const bundleDevice = await (prisma as any).bundleDevice.findFirst({
      where: { bundleId, deviceId },
      select: { id: true }
    });
    
    if (!bundleDevice) {
      logger.warn(`[BundleEventProcessor] No bundleDevice found for device ${deviceId} in bundle ${bundleId}. Device may not be assigned to bundle yet.`);
      return;
    }
    
    const deviceProgress = await (prisma as any).bundleDeviceProgress.findFirst({
      where: { 
        bundleId,
        bundleDeviceId: bundleDevice.id
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

    if (!deviceProgress) {
      logger.warn(`[BundleEventProcessor] No existing progress found for device ${deviceId} in bundle ${bundleId}. Device may not be assigned to any wave yet.`);
      return;
    }

    const correctWaveId = deviceProgress.waveId;
    
    // Validate that the wave is still active
    const correctWave = await (prisma as any).bundleWave.findUnique({
      where: { id: correctWaveId },
      select: { id: true, status: true, name: true }
    });
    
    if (!correctWave) {
      logger.error(`[BundleEventProcessor] Wave ${correctWaveId} not found for device ${deviceId}. Skipping.`);
      return;
    }
    
    if (correctWaveId !== waveId) {
      logger.warn(`[BundleEventProcessor] Device ${deviceId} sent progress for wave ${waveId} but is assigned to wave ${correctWaveId} (${correctWave.name}). Using correct wave.`);
    }
    
    // Check if the wave is in a terminal state
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(correctWave.status)) {
      logger.warn(`[BundleEventProcessor] Device ${deviceId} sent progress for wave ${correctWaveId} (${correctWave.name}) but wave is in terminal state: ${correctWave.status}. Skipping.`);
      return;
    }

    // Try find existing progress row by correctWaveId + bundleDeviceId
    const existing = await (prisma as any).bundleDeviceProgress.findFirst({
      where: { waveId: correctWaveId, bundleDeviceId: deviceProgress.bundleDeviceId },
      select: { id: true, status: true, metadata: true }
    });

    const isTerminalNext = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
    const metadataStr = JSON.stringify({ progress });

    if (!existing) {
      await (prisma as any).bundleDeviceProgress.create({
        data: {
          bundleId,
          waveId: correctWaveId,
          bundleDeviceId: deviceProgress.bundleDeviceId,
          status,
          result: message || null,
          errorDetails: status === 'FAILED' ? (message || null) : null,
          startedAt: null, // startedAt is set when server sends command, not when device reports back
          completedAt: isTerminalNext ? new Date() : null,
          retryCount: 0,
          metadata: metadataStr,
          transactionId: logId || null,
          createdBy: 'system',
          updatedBy: 'system'
        }
      });
      logger.debug(`[BundleEventProcessor] Created progress row wave=${correctWaveId} bundleDeviceId=${deviceProgress.bundleDeviceId} status=${status} progress=${progress}`);
    } else {
      const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(existing.status);
      if (!isTerminal) {
        await (prisma as any).bundleDeviceProgress.update({
          where: { id: existing.id },
          data: {
            status,
            result: message || null,
            errorDetails: status === 'FAILED' ? (message || null) : null,
            startedAt: undefined, // startedAt is set when server sends command, not when device reports back
            completedAt: isTerminalNext ? new Date() : undefined,
            metadata: metadataStr,
            updatedBy: 'system'
          }
        });
        logger.debug(`[BundleEventProcessor] Updated progress row id=${existing.id} -> status=${status} progress=${progress}`);
      } else {
        logger.debug(`[BundleEventProcessor] Skipped update (terminal=${existing.status}) id=${existing.id}`);
      }
    }

    // Recompute wave aggregate and update + publish
    await recomputeWaveAndPublish(correctWaveId, bundleId, correctWave.name);
  } catch (e: any) {
    logger.warn(`[BundleEventProcessor] Upsert device progress failed: ${String(e?.message || e)}`);
  }
}

async function recomputeWaveAndPublish(waveId: string, bundleId: string, waveName: string) {
  try {
    logger.info(`[BundleEventProcessor] Starting wave recompute for wave ${waveId}`);
    const all = await (prisma as any).bundleDeviceProgress.findMany({
      where: { waveId },
      include: { bundleDevice: { select: { deviceId: true } } },
      orderBy: [{ completedAt: 'desc' }, { id: 'asc' }]
    });
    const deviceIds = [...new Set(all.map((r: any) => r.bundleDevice.deviceId))];
    const devices = await (prisma as any).device.findMany({
      where: { id: { in: deviceIds } },
      select: { id: true, name: true }
    });
    const deviceMap = new Map(devices.map((d: any) => [d.id, d.name]));
    all.sort((a: any, b: any) =>
      compareProgressOrder(
        a.completedAt ? a.completedAt.getTime() : 0,
        String(deviceMap.get(a.bundleDevice.deviceId) ?? ''),
        b.completedAt ? b.completedAt.getTime() : 0,
        String(deviceMap.get(b.bundleDevice.deviceId) ?? '')
      )
    );
    const devicesTotal = all.length;
    const devicesCompleted = all.filter((r: any) => r.status === 'COMPLETED').length;
    const devicesFailed = all.filter((r: any) => r.status === 'FAILED').length;
    logger.info(`[BundleEventProcessor] Wave ${waveId} device counts: total=${devicesTotal}, completed=${devicesCompleted}, failed=${devicesFailed}`);
    
    // Wave progress = percentage of devices that have been processed (completed + failed)
    // NOT the average of individual device progress percentages
    const waveProgress = devicesTotal > 0 ? Math.round(((devicesCompleted + devicesFailed) / devicesTotal) * 100) : 0;
    
    // Wave status based on device completion status
    const waveStatus = (devicesCompleted + devicesFailed >= devicesTotal && devicesTotal > 0)
      ? (devicesFailed > 0 ? 'FAILED' : 'COMPLETED')
      : 'IN_PROGRESS';

    // Get current wave status to check if we need to set startTime
    const currentWave = await (prisma as any).bundleWave.findUnique({
      where: { id: waveId },
      select: { status: true, startTime: true }
    });

    // Update only fields that exist: status, startTime, and endTime (do not set numeric progress if schema doesn't have it)
    const updateData: any = {
      status: waveStatus,
      endTime: waveStatus !== 'IN_PROGRESS' ? new Date() : undefined
    };

    // Only set startTime if transitioning from PENDING to IN_PROGRESS and startTime is not already set
    if (waveStatus === 'IN_PROGRESS' && currentWave?.status === 'PENDING' && !currentWave?.startTime) {
      updateData.startTime = new Date();
      logger.info(`[BundleEventProcessor] Setting startTime for wave ${waveId} transitioning from PENDING to IN_PROGRESS`);
    }

    await (prisma as any).bundleWave.update({
      where: { id: waveId },
      data: updateData
    });
    logger.info(`[BundleEventProcessor] Wave ${waveId} aggregate: total=${devicesTotal} completed=${devicesCompleted} failed=${devicesFailed} progress=${waveProgress} status=${waveStatus}`);

    // Publish wave status update to UI via MQTT
    let effectiveBundleId = bundleId;
    if (!effectiveBundleId) {
      try {
        const wave = await (prisma as any).bundleWave.findUnique({ where: { id: waveId }, select: { bundleId: true } });
        effectiveBundleId = wave?.bundleId;
      } catch {}
    }
    
    try {
      logger.info(`[BundleEventProcessor] Publishing wave status update via MQTT: bundleId=${effectiveBundleId}, waveId=${waveId}, status=${waveStatus}, progress=${waveProgress}`);
      
      // Get bundle accountId for MQTT topic
      const bundle = await (prisma as any).bundle.findUnique({
        where: { id: effectiveBundleId },
        select: { accountId: true }
      });
      
      if (bundle && bundle.accountId) {
        const { publishToAccountMembers } = await import('$lib/server/mqtt/notifications/bundleNotifications');
        const { DeviceNotificationType } = await import('$lib/server/mqtt/core/publish');
        
        await publishToAccountMembers(
          prisma,
          bundle.accountId,
          DeviceNotificationType.BundleWaveStatus,
          {
            action: 'waveStatus',
            bundleId: effectiveBundleId,
            waveId,
            status: waveStatus,
            progress: waveProgress,
            devicesTotal,
            devicesCompleted,
            devicesFailed,
            endTime: waveStatus !== 'IN_PROGRESS' ? new Date().toISOString() : undefined
          }
        );
        
        logger.info(`[BundleEventProcessor] Successfully published wave status via MQTT for waveId=${waveId}`);
      } else {
        logger.warn(`[BundleEventProcessor] Bundle ${effectiveBundleId} not found or missing accountId, skipping MQTT broadcast`);
      }
    } catch (pubErr) {
      logger.warn(`[BundleEventProcessor] Publish wave status via MQTT failed: ${String(pubErr)}`);
    }

    // Update bundle status based on all waves
    await updateBundleStatus(prisma, effectiveBundleId);

    // If wave reached terminal status, try to start the next wave automatically
    if (waveStatus === 'COMPLETED' || waveStatus === 'FAILED') {
      logger.info(`[BundleEventProcessor] Wave ${waveId} (${waveName}) reached terminal status: ${waveStatus}, attempting to start next wave for bundle ${effectiveBundleId}`);
      try {
        await checkAndAutoStartNextWave(effectiveBundleId, waveId);
        logger.info(`[BundleEventProcessor] Successfully triggered auto-start for next wave after ${waveName} completed`);
      } catch (autoStartErr: any) {
        logger.warn(`[BundleEventProcessor] Auto-start next wave failed: ${String(autoStartErr?.message || autoStartErr)}`);
      }
    }
  } catch (aggErr: any) {
    logger.error(`[BundleEventProcessor] Wave recompute failed: ${String(aggErr?.message || aggErr)}`);
    logger.error(`[BundleEventProcessor] Wave recompute error stack: ${aggErr?.stack || 'No stack trace'}`);
  }
}

export async function updateBundleStatus(prisma: any, bundleId: string) {
  try {
    // Get all waves for this bundle
    const waves = await (prisma as any).bundleWave.findMany({
      where: { bundleId },
      select: { id: true, status: true, startTime: true, endTime: true }
    });
    
    if (!waves || waves.length === 0) {
      logger.debug(`[BundleEventProcessor] No waves found for bundle ${bundleId}`);
      return;
    }
    
    // Calculate bundle status based on wave statuses
    const anyInProgress = waves.some((w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING');
    const anyFailed = waves.some((w: any) => w.status === 'FAILED');
    const allCompleted = waves.every((w: any) => w.status === 'COMPLETED');
    const allTerminal = waves.every((w: any) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(w.status));
    
    let bundleStatus: string;
    if (anyInProgress) {
      bundleStatus = 'IN_PROGRESS';
    } else if (allCompleted) {
      bundleStatus = 'COMPLETED';
    } else if (anyFailed && allTerminal) {
      bundleStatus = 'FAILED';
    } else {
      // All waves are terminal but mix of completed/cancelled (no failed)
      bundleStatus = 'COMPLETED';
    }
    
    // Update bundle status
    await (prisma as any).bundle.update({
      where: { id: bundleId },
      data: { 
        status: bundleStatus
      }
    });
    
    logger.info(`[BundleEventProcessor] Updated bundle ${bundleId} status to ${bundleStatus} (waves: ${waves.length}, inProgress: ${anyInProgress}, failed: ${anyFailed}, allCompleted: ${allCompleted})`);
  } catch (e: any) {
    logger.warn(`[BundleEventProcessor] Failed to update bundle status for ${bundleId}: ${String(e?.message || e)}`);
  }
}

export async function processEventsWithStateValidation(events: ClickHouseEvent[]) {
  const stateManager = getStateManager();
  
  // Group events by bundleId for batch processing
  const eventsByBundle = new Map<string, ClickHouseEvent[]>();
  
  for (const event of events) {
    try {
      // 1. Check if we should process this event based on bundle state
      const shouldProcess = await shouldProcessEvent(event);
      
      if (!shouldProcess) {
        // logger.debug(`[BundleEventProcessor] Skipping event for bundle ${event.bundle_id} - not processable`);
        continue;
      }
      
      // 2. Check for duplicate
      if (await eventDeduplication.isEventProcessed(event)) {
        continue;
      }
      
      // 3. Group by bundle for batch processing
      if (!eventsByBundle.has(event.bundle_id)) {
        eventsByBundle.set(event.bundle_id, []);
      }
      eventsByBundle.get(event.bundle_id)!.push(event);
      
    } catch (e: any) {
      logger.warn(`[BundleEventProcessor] Failed to validate event: ${String(e?.message || e)}`);
    }
  }
  
  // Process each bundle's events in batch
  for (const [bundleId, bundleEvents] of eventsByBundle) {
    try {
      await processBatchEvents(bundleId, bundleEvents);
    } catch (e: any) {
      logger.warn(`[BundleEventProcessor] Failed to process batch for bundle ${bundleId}: ${String(e?.message || e)}`);
    }
  }
}

async function processBatchEvents(bundleId: string, events: ClickHouseEvent[]) {
  const stateManager = getStateManager();
  
  // Convert events to FileStatusEvent format
  const fileEvents: FileStatusEvent[] = events.map(event => ({
    deviceId: event.device_id,
    waveId: event.wave_id,
    bundleId: event.bundle_id,
    logId: undefined,
    status: event.status,
    progress: event.progress,
    message: event.message,
    error: event.status === 'FAILED' ? event.message : null,
    timestamp: event.ts
  }));
  
  // Process events in batch
  await processBatchDeviceEvents(bundleId, fileEvents);
  
  // Mark all events as processed
  for (const event of events) {
    await eventDeduplication.markEventAsProcessed(event);
  }
  
  // Update bundle state
  const latestEvent = events[events.length - 1]; // Use latest event for state update
  await updateBundleStateIfNeeded(bundleId, latestEvent);
  
  // Check if bundle should transition to COMPLETED
  await checkAndTransitionBundleState(bundleId);
}

async function processBatchDeviceEvents(bundleId: string, events: FileStatusEvent[]) {
  if (events.length === 0) return;
  
  logger.info(`[BundleEventProcessor] Processing batch of ${events.length} events for bundle ${bundleId}`);
  
  // Group events by device for efficient processing
  const eventsByDevice = new Map<string, FileStatusEvent[]>();
  
  for (const event of events) {
    const deviceId = String(event.deviceId || '').trim();
    if (!deviceId) continue;
    
    if (!eventsByDevice.has(deviceId)) {
      eventsByDevice.set(deviceId, []);
    }
    eventsByDevice.get(deviceId)!.push(event);
  }
  
  // Process each device's events
  const deviceUpdates = new Map<string, any>();
  const waveUpdates = new Map<string, any>();
  
  for (const [deviceId, deviceEvents] of eventsByDevice) {
    try {
      const result = await processDeviceEventsBatch(bundleId, deviceId, deviceEvents);
      if (result) {
        deviceUpdates.set(deviceId, result);
        if (result.waveId) {
          waveUpdates.set(result.waveId, result);
        }
      }
    } catch (e: any) {
      logger.warn(`[BundleEventProcessor] Failed to process device ${deviceId}: ${String(e?.message || e)}`);
    }
  }
  
  // Batch update database
  if (deviceUpdates.size > 0) {
    await batchUpdateDatabase(deviceUpdates, waveUpdates);
  }
}

async function processDeviceEventsBatch(bundleId: string, deviceId: string, events: FileStatusEvent[]) {
  // Get the latest event (most recent status)
  const latestEvent = events[events.length - 1];
  const rawWaveId = String(latestEvent.waveId || '').trim();
  if (!rawWaveId) return null;
  
  const waveId = rawWaveId.startsWith('wave:') ? rawWaveId.slice(5) : rawWaveId;
  let status = normalizeStatus(latestEvent.status);
  const progress = clamp(Number(latestEvent.progress ?? 0), 0, 100);
  const message = latestEvent.message || undefined;
  
  // If progress has reached 100 and not explicitly failed/cancelled, coerce to COMPLETED
  if (progress === 100 && status !== 'FAILED' && status !== 'CANCELLED') {
    status = 'COMPLETED';
  }
  
  // Find device progress record using helper function
  const result = await findDeviceProgress(bundleId, deviceId, waveId);
  if (!result) {
    logger.warn(`[BundleEventProcessor] No existing progress found for device ${deviceId} in bundle ${bundleId}, wave ${waveId}. Device may not be assigned to this wave.`);
    return null;
  }

  const { progress: deviceProgress } = result;

  const correctWaveId = deviceProgress.waveId;
  
  // Validate wave is still active
  const correctWave = await (prisma as any).bundleWave.findUnique({
    where: { id: correctWaveId },
    select: { id: true, status: true, name: true }
  });
  
  if (!correctWave) {
    logger.error(`[BundleEventProcessor] Wave ${correctWaveId} not found for device ${deviceId}`);
    return null;
  }
  
  // Validate if wave can accept events using helper function
  const validation = await validateWaveCanAcceptEvents(
    bundleId,
    correctWaveId,
    correctWave.status,
    latestEvent.timestamp ? new Date(latestEvent.timestamp) : new Date()
  );

  if (!validation.canAccept) {
    logger.debug(`[BundleEventProcessor] Device ${deviceId} sent progress for wave ${correctWaveId}: ${validation.reason}`);
    return null;
  }

  if (validation.reason) {
    logger.info(`[BundleEventProcessor] Device ${deviceId} sent progress for wave ${correctWaveId}: ${validation.reason}`);
  }

  // Find existing progress row
  const existing = await (prisma as any).bundleDeviceProgress.findFirst({
    where: { waveId: correctWaveId, bundleDeviceId: deviceProgress.bundleDeviceId },
    select: { id: true, status: true, metadata: true }
  });

  const isTerminalNext = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
  const metadataStr = JSON.stringify({ progress });
  
  // Check if existing record is terminal
  const existingIsTerminal = existing ? ['COMPLETED', 'FAILED', 'CANCELLED'].includes(existing.status) : false;
  
  // For terminal waves (FAILED/CANCELLED), we allow updates during active period
  // So we should allow updates even if existing is terminal, as long as the wave check passed above
  const allowTerminalUpdate = existingIsTerminal && ['FAILED', 'CANCELLED'].includes(correctWave.status);

  return {
    deviceId,
    waveId: correctWaveId,
    bundleId,
    bundleDeviceId: deviceProgress.bundleDeviceId,
    existing,
    updateData: {
      status,
      result: message || null,
      errorDetails: status === 'FAILED' ? (message || null) : null,
      completedAt: isTerminalNext ? new Date() : undefined,
      metadata: metadataStr,
      updatedBy: 'system'
    },
    isNew: !existing,
    isTerminal: existingIsTerminal && !allowTerminalUpdate // Only mark as terminal if we're not allowing the update
  };
}

async function batchUpdateDatabase(deviceUpdates: Map<string, any>, waveUpdates: Map<string, any>) {
  try {
    // Use Prisma transaction for batch operations
    await (prisma as any).$transaction(async (tx: any) => {
      // Batch create new progress records
      const newRecords = Array.from(deviceUpdates.values())
        .filter(update => update.isNew)
        .map(update => ({
          bundleId: update.bundleId,
          waveId: update.waveId,
          bundleDeviceId: update.bundleDeviceId,
          status: update.updateData.status,
          result: update.updateData.result,
          errorDetails: update.updateData.errorDetails,
          startedAt: null,
          completedAt: update.updateData.completedAt,
          retryCount: 0,
          metadata: update.updateData.metadata,
          transactionId: null,
          createdBy: 'system',
          updatedBy: 'system'
        }));

      if (newRecords.length > 0) {
        await tx.bundleDeviceProgress.createMany({
          data: newRecords
        });
        logger.info(`[BundleEventProcessor] Batch created ${newRecords.length} new progress records`);
      }

      // Batch update existing progress records
      const updatePromises = Array.from(deviceUpdates.values())
        .filter(update => !update.isNew && !update.isTerminal)
        .map(update => 
          tx.bundleDeviceProgress.update({
            where: { id: update.existing.id },
            data: update.updateData
          })
        );

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        logger.info(`[BundleEventProcessor] Batch updated ${updatePromises.length} progress records`);
      }
    });

    // Process wave updates after database updates
    for (const [waveId, waveData] of waveUpdates) {
      await recomputeWaveAndPublish(waveId, waveData.bundleId, waveData.waveName);
    }
    
  } catch (e: any) {
    logger.error(`[BundleEventProcessor] Batch database update failed: ${String(e?.message || e)}`);
    throw e;
  }
}

async function shouldProcessEvent(event: ClickHouseEvent): Promise<boolean> {
  const stateManager = getStateManager();
  const bundleState = await stateManager.getBundleState(event.bundle_id);
  
  if (!bundleState) {
    // If bundle doesn't exist in state, check if it exists in database
    const bundle = await (prisma as any).bundle.findUnique({
      where: { id: event.bundle_id },
      select: { id: true, status: true }
    });
    
    if (!bundle) {
      logger.debug(`[BundleEventProcessor] Bundle ${event.bundle_id} not found in database`);
      return false;
    }
    
    // Initialize bundle state as ACTIVE if it exists in database
    await stateManager.setBundleState(event.bundle_id, {
      bundleId: event.bundle_id,
      state: BundleProcessingState.ACTIVE,
      timeoutAt: null,
      gracePeriodHours: 2,
      lastDeviceResponse: null,
      updatedAt: new Date()
    });
    
    return true;
  }
  
  switch (bundleState.state) {
    case BundleProcessingState.ACTIVE:
      return true;
      
    case BundleProcessingState.TIMEOUT_PENDING:
      // Grace period is now tied to active period, not fixed 2-hour window
      try {
        const withinPeriod = await isWithinActivePeriod(event.bundle_id, event.ts);
        if (withinPeriod) {
          return true;
        }
        
        // Fallback to old logic if active period check fails
        if (bundleState.timeoutAt) {
          const gracePeriodEnd = new Date(
            bundleState.timeoutAt.getTime() + bundleState.gracePeriodHours * 60 * 60 * 1000
          );
          return new Date(event.ts) <= gracePeriodEnd;
        }
        return false;
      } catch (error) {
        logger.warn(`[BundleEventProcessor] Failed to check grace period for bundle ${event.bundle_id}: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to old logic if error occurs
        if (bundleState.timeoutAt) {
          const gracePeriodEnd = new Date(
            bundleState.timeoutAt.getTime() + bundleState.gracePeriodHours * 60 * 60 * 1000
          );
          return new Date(event.ts) <= gracePeriodEnd;
        }
        return false;
      }
      
    case BundleProcessingState.COMPLETED:
      // COMPLETED bundles never accept new events
      return false;
      
    case BundleProcessingState.FAILED:
    case BundleProcessingState.CANCELLED:
      // FAILED and CANCELLED bundles can still accept late device responses during active period
      try {
        const withinPeriod = await isWithinActivePeriod(event.bundle_id, event.ts);
        if (withinPeriod) {
          return true;
        }
        
        // Fallback: use grace period from bundle state if active period check fails
        if (bundleState.timeoutAt) {
          const gracePeriodEnd = new Date(
            bundleState.timeoutAt.getTime() + bundleState.gracePeriodHours * 60 * 60 * 1000
          );
          return new Date(event.ts) <= gracePeriodEnd;
        }
        return false;
      } catch (error) {
        logger.warn(`[BundleEventProcessor] Failed to check active period for FAILED/CANCELLED bundle ${event.bundle_id}: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback: use grace period from bundle state
        if (bundleState.timeoutAt) {
          const gracePeriodEnd = new Date(
            bundleState.timeoutAt.getTime() + bundleState.gracePeriodHours * 60 * 60 * 1000
          );
          return new Date(event.ts) <= gracePeriodEnd;
        }
        return false;
      }
      
    default:
      return false;
  }
}

async function updateBundleStateIfNeeded(bundleId: string, event: ClickHouseEvent): Promise<void> {
  const stateManager = getStateManager();
  const bundleState = await stateManager.getBundleState(bundleId);
  
  if (!bundleState) return;
  
  if (bundleState.state === BundleProcessingState.COMPLETED) {
    return;
  }
  
  // Update last device response time
  const updatedState = {
    ...bundleState,
    lastDeviceResponse: new Date(event.ts)
  };
  
  await stateManager.setBundleState(bundleId, updatedState);
  
  // Check if bundle should transition to TIMEOUT_PENDING
  if (bundleState.state === BundleProcessingState.ACTIVE) {
    // This would be triggered by timeout logic in applyTimeouts
    // For now, we just update the last response time
  }
}

export async function checkAndTransitionBundleState(bundleId: string): Promise<void> {
  try {
    const stateManager = getStateManager();
    const bundleState = await stateManager.getBundleState(bundleId);
    
    if (!bundleState || bundleState.state !== BundleProcessingState.ACTIVE) {
      return; // Only check ACTIVE bundles
    }
    
    // Check if all waves are in terminal states
    const waves = await (prisma as any).bundleWave.findMany({
      where: { bundleId },
      select: { id: true, status: true }
    });
    
    if (waves.length === 0) {
      return; // No waves found
    }
    
    const allWavesComplete = waves.every((wave: any) => 
      ['COMPLETED', 'FAILED', 'CANCELLED'].includes(wave.status)
    );
    
    if (allWavesComplete) {
      // Determine final bundle state
      const hasFailedWaves = waves.some((wave: any) => wave.status === 'FAILED');
      const finalState = hasFailedWaves ? BundleProcessingState.FAILED : BundleProcessingState.COMPLETED;
      
      // Update bundle state
      const updatedState = {
        ...bundleState,
        state: finalState,
        updatedAt: new Date()
      };
      
      await stateManager.setBundleState(bundleId, updatedState);
      logger.info(`[BundleEventProcessor] Bundle ${bundleId} transitioned to ${finalState} - all waves complete`);
      
      // Update bundle status in database
      await (prisma as any).bundle.update({
        where: { id: bundleId },
        data: { status: finalState }
        // Note: Bundle model doesn't have endTime field - this is tracked at wave level
      });
      
      // Publish SSE update
      try {
        // Get bundle accountId for MQTT topic
        const bundle = await (prisma as any).bundle.findUnique({
          where: { id: bundleId },
          select: { accountId: true }
        });
        
        if (bundle && bundle.accountId) {
          const { publishToAccountMembers } = await import('$lib/server/mqtt/notifications/bundleNotifications');
          const { DeviceNotificationType } = await import('$lib/server/mqtt/core/publish');
          
          await publishToAccountMembers(
            prisma,
            bundle.accountId,
            DeviceNotificationType.BundleStatus,
            {
              action: 'bundleStatus',
              bundleId,
              status: finalState
            }
          );
          
          logger.info(`[BundleEventProcessor] Published bundle status update via MQTT: ${bundleId} -> ${finalState}`);
        } else {
          logger.warn(`[BundleEventProcessor] Bundle ${bundleId} not found or missing accountId, skipping MQTT broadcast`);
        }
      } catch (e) {
        logger.warn(`[BundleEventProcessor] Failed to publish bundle status update: ${String(e instanceof Error ? e.message : e)}`);
      }
    }
  } catch (error) {
    logger.warn(`[BundleEventProcessor] Failed to check bundle state transition for ${bundleId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function normalizeStatus(s: string): string {
  const v = String(s || '').toUpperCase();
  switch (v) {
    case 'IN_PROGRESS':
    case 'PENDING':
    case 'COMPLETED':
    case 'FAILED':
    case 'CANCELLED':
      return v;
    default:
      // Map runtime terms to known
      if (v === 'SUCCESS') return 'COMPLETED';
      if (v === 'STARTED') return 'IN_PROGRESS';
      return 'IN_PROGRESS';
  }
}

export function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
