import { error } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { fetchTableData } from '$lib/components/ui_components_sveltekit/table/utils/server';
import { createBundleTableOptions } from './bundleTableOptions';
import { superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';

/**
 * Helper function to update bundle status based on wave statuses (on page load).
 *
 * Respects user-set statuses:
 * - STOPPED / CANCELLED: Never overwritten. User set these via Stop/Cancel so they can Resume later;
 *   we do not transition to COMPLETED/FAILED when the in-progress wave finishes.
 * - PUBLISHED: Not overwritten with IN_PROGRESS (keeps "Published" until event processor updates it).
 * - Only transitions to COMPLETED or FAILED when bundle is not STOPPED/CANCELLED and all waves are terminal.
 */
async function updateBundleStatus(prisma: any, bundleId: string) {
  try {
    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      select: { status: true }
    });
    if (!bundle) return;

    const current = (bundle.status || '').toUpperCase();

    const waves = await prisma.bundleWave.findMany({
      where: { bundleId },
      select: { id: true, status: true, startTime: true, endTime: true }
    });

    if (!waves || waves.length === 0) {
      return;
    }

    const anyInProgress = waves.some((w: any) => w.status === 'IN_PROGRESS' || w.status === 'PENDING');
    const anyFailed = waves.some((w: any) => w.status === 'FAILED');
    const allCompleted = waves.every((w: any) => w.status === 'COMPLETED');
    const allTerminal = waves.every((w: any) => ['COMPLETED', 'FAILED', 'CANCELLED', 'STOPPED'].includes(w.status));

    let bundleStatus: string;
    if (anyInProgress) {
      bundleStatus = 'IN_PROGRESS';
    } else if (allCompleted) {
      bundleStatus = 'COMPLETED';
    } else if (anyFailed && allTerminal) {
      bundleStatus = 'FAILED';
    } else {
      bundleStatus = 'COMPLETED';
    }

    // Keep PUBLISHED when waves are in progress so refresh after Publish still shows "Published"
    if (current === 'PUBLISHED' && bundleStatus === 'IN_PROGRESS') {
      return;
    }

    // Never overwrite user-set STOPPED/CANCELLED (so user can Resume later).
    if (current === 'STOPPED' || current === 'CANCELLED') {
      return;
    }

    if (current === bundleStatus) {
      return; // No change needed
    }

    await prisma.bundle.update({
      where: { id: bundleId },
      data: { status: bundleStatus }
    });

    logger.info(`[PageLoad] Updated bundle ${bundleId} status from ${current} to ${bundleStatus} (waves: ${waves.length}, inProgress: ${anyInProgress}, failed: ${anyFailed}, allCompleted: ${allCompleted})`);
  } catch (e: any) {
    logger.warn(`[PageLoad] Failed to update bundle status for ${bundleId}: ${String(e?.message || e)}`);
  }
}

/**
 * Load bundle list data
 * Per structural standard: load{Resource}List pattern
 */
export async function loadBundleList(
  locals: any,
  url: URL,
  options?: {
    checkOwnership?: boolean;
    userId?: string;
    accountId?: string;
  }
) {
  try {
    // Create table options with optional ownership filtering
    const tableOptions = options?.checkOwnership
      ? createBundleTableOptions({
          checkOwnership: true,
          userId: options.userId,
          accountId: options.accountId
        })
      : createBundleTableOptions(); // No ownership filtering for admin
    
    // Fetch table data with the appropriate options
    const result = await fetchTableData(locals, url, tableOptions);
    return { bundles: result.records, meta: result.meta };
  } catch (e) {
    logger.error(`Error loading bundles: ${JSON.stringify(e)}`);
    throw error(500, 'Failed to load bundles');
  }
}

/**
 * Load bundle detail data
 * Per structural standard: load{Resource}Detail pattern
 */
export async function loadBundleDetail(
  locals: any,
  bundleId: string,
  options?: {
    includeAccount?: boolean;
    checkDeviceOnline?: boolean;
    enableAutoStartWaves?: boolean;
    enableTimeoutChecking?: boolean;
  }
) {
  const { prisma, currentAccount } = locals;
  
  try {
    // Fetch the bundle by ID with related data
    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      include: {
        apps: {
          include: {
            resource: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        waves: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!bundle) {
      throw error(404, 'Bundle not found');
    }

    // Enrich waves with aggregate device counts and progress
    if (bundle && Array.isArray(bundle.waves) && bundle.waves.length) {
      const enrichedWaves = [];
      for (const w of bundle.waves) {
        try {
          const [total, completed, failed] = await Promise.all([
            prisma.bundleDeviceProgress.count({ where: { waveId: w.id } }),
            prisma.bundleDeviceProgress.count({ where: { waveId: w.id, status: 'COMPLETED' } }),
            prisma.bundleDeviceProgress.count({ where: { waveId: w.id, status: 'FAILED' } })
          ]);

          // Wave progress = percentage of devices that have been processed (completed + failed)
          const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
          enrichedWaves.push({ ...w, devicesTotal: total, devicesCompleted: completed, devicesFailed: failed, progress });
        } catch {
          enrichedWaves.push({ ...w, devicesTotal: 0, devicesCompleted: 0, devicesFailed: 0, progress: 0 });
        }
      }
      bundle.waves = enrichedWaves as any;

      // Admin-only: Auto-start next wave logic
      if (options?.enableAutoStartWaves) {
        const sortedWaves = enrichedWaves.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        for (let i = 0; i < sortedWaves.length - 1; i++) {
          const currentWave = sortedWaves[i];
          const nextWave = sortedWaves[i + 1];
          
          // If current wave is finished (COMPLETED or FAILED) and next wave is still PENDING
          if ((currentWave.status === 'COMPLETED' || currentWave.status === 'FAILED') && nextWave.status === 'PENDING') {
            try {
              const { checkAndAutoStartNextWave } = await import('$lib/server/messaging/handlers/device/bundleUtils');
              await checkAndAutoStartNextWave(bundle.id, currentWave.id);
              logger.info(`[PageLoad] Auto-started wave ${nextWave.id} for bundle ${bundle.id} during page load`);
            } catch (autoStartErr: any) {
              logger.warn(`[PageLoad] Failed to auto-start wave during page load: ${autoStartErr?.message || String(autoStartErr)}`);
            }
          }
        }
      }

      // Admin-only: Wave timeout checking
      if (options?.enableTimeoutChecking) {
        for (const wave of enrichedWaves) {
          if (wave.status === 'IN_PROGRESS') {
            try {
              // Check if any devices in this wave are still PENDING or IN_PROGRESS
              const pendingDevices = await prisma.bundleDeviceProgress.findMany({
                where: { 
                  waveId: wave.id,
                  status: { in: ['PENDING', 'IN_PROGRESS'] }
                },
                include: { bundleDevice: true }
              });
              
              if (pendingDevices.length > 0) {
                // Set up timeouts for devices that don't have them
                const bundleApps = await prisma.bundleApp.findMany({
                  where: { bundleId: bundle.id },
                  select: { id: true }
                });
                const numApps = bundleApps.length;
                const timeoutMs = numApps * 10 * 60 * 1000; // 10 minutes per app
                
                for (const prog of pendingDevices) {
                  // Check if this device has been running for more than the timeout period
                  const deviceStartTime = prog.startedAt || wave.startTime;
                  if (deviceStartTime) {
                    const elapsedMs = Date.now() - new Date(deviceStartTime).getTime();
                    if (elapsedMs > timeoutMs) {
                      // Device has exceeded timeout, mark it as failed
                      await prisma.bundleDeviceProgress.update({
                        where: { id: prog.id },
                        data: {
                          status: 'FAILED',
                          completedAt: new Date(),
                          errorDetails: 'timeout'
                        }
                      });
                      
                      logger.info(`[PageLoad] Marked device ${prog.bundleDevice.deviceId} in wave ${wave.id} as failed due to timeout`);
                    }
                  }
                }
              }
            } catch (timeoutErr: any) {
              logger.warn(`[PageLoad] Failed to check timeouts for wave ${wave.id}: ${timeoutErr?.message || String(timeoutErr)}`);
            }
          }
        }
      }
    }
    
    // Update bundle status based on all waves
    await updateBundleStatus(prisma, bundleId);
    
    // Fetch bundle devices with device information
    const bundleDevices = await prisma.bundleDevice.findMany({
      where: { bundleId },
      include: {
        bundle: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Latest progress per bundleDeviceId (so Deployment Device table matches batch detail / progress API)
    const bundleDeviceIds = bundleDevices.map((bd: any) => bd.id);
    const allProgress = bundleDeviceIds.length > 0
      ? await prisma.bundleDeviceProgress.findMany({
          where: { bundleDeviceId: { in: bundleDeviceIds } },
          select: { bundleDeviceId: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        })
      : [];
    const latestStatusByBundleDeviceId = new Map<string, string>();
    for (const p of allProgress) {
      if (!latestStatusByBundleDeviceId.has(p.bundleDeviceId)) {
        latestStatusByBundleDeviceId.set(p.bundleDeviceId, p.status);
      }
    }

    // Fetch device information for each bundle device
    const bundleDevicesWithDeviceInfo = await Promise.all(
      bundleDevices.map(async (bundleDevice: any) => {
        const device = await prisma.device.findUnique({
          where: { id: bundleDevice.deviceId },
          select: {
            id: true,
            name: true,
            model: true,
            status: true,
            connected: true,
            deviceType: true,
            osVersion: true
          }
        });
        
        // Admin-only: Real-time device online status check
        if (options?.checkDeviceOnline && device) {
          const { isDeviceOnline } = await import('$lib/server/device/devicePresence');
          const isOnline = await isDeviceOnline(device.id);
          device.connected = isOnline;  // Override DB value with real-time Redis status
        }
        
        // Deployment status from latest progress so it matches batch detail / progress API (avoids "Failed" in batch but "In Progress" in Devices)
        const deploymentStatus = latestStatusByBundleDeviceId.get(bundleDevice.id) ?? bundleDevice.status;
        
        return {
          ...bundleDevice,
          status: deploymentStatus,
          device: device || {
            id: bundleDevice.deviceId,
            name: 'Unknown Device',
            model: 'Unknown',
            status: 'UNKNOWN'
          }
        };
      })
    );
    
    // Admin-only: Fetch account info separately if accountId is present
    let account = null;
    if (options?.includeAccount && bundle?.accountId) {
      account = await prisma.account.findUnique({
        where: { id: bundle.accountId },
        select: {
          id: true,
          name: true
        }
      });
    }
    
    // Admin-only: Fetch accounts for the dropdown
    const accounts = options?.includeAccount ? await prisma.account.findMany({
      where: { isSystem: false },
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    }) : [];
    
    // Fetch resources (apps) for the bundle apps component
    const resources = await prisma.resource.findMany({
      where: {
        type: 'APK' // Assuming we're only interested in APK resources
      },
      select: {
        id: true,
        name: true,
        description: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        size: true,
        format: true,
        packageName: true,
        target: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Create a form with the bundle data
    // Import bundleSchema from admin route (both admin and user have identical schema)
    const { bundleSchema } = await import('../../../routes/admin/iot/bundles/new/bundle');
    const form = await superValidate(bundle, zod(bundleSchema));
    
    // Add account to bundle for the UI
    const bundleWithAccount = {
      ...bundle,
      account: account || (options?.includeAccount ? null : currentAccount?.account)
    };
    
    return {
      bundle: bundleWithAccount,
      bundleDevices: bundleDevicesWithDeviceInfo,
      accounts: options?.includeAccount ? accounts : undefined,
      resources,
      form,
      meta: {
        title: `Bundle: ${bundle.name || bundle.id}`,
        description: `Manage bundle details for ${bundle.name || bundle.id}`
      }
    };
  } catch (err) {
    logger.error(`Error loading bundle details: ${err instanceof Error ? err.message : String(err)}`);
    throw error(500, 'Failed to load bundle details');
  }
}

