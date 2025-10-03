import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { message, superValidate } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';
import { bundleSchema } from '../new/bundle';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

// Helper function to update bundle status based on wave statuses
async function updateBundleStatus(prisma: any, bundleId: string) {
  try {
    // Get all waves for this bundle
    const waves = await (prisma as any).bundleWave.findMany({
      where: { bundleId },
      select: { id: true, status: true, startTime: true, endTime: true }
    });
    
    if (!waves || waves.length === 0) {
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
        // Note: Bundle model doesn't have endTime field - this is tracked at wave level
      }
    });
    
    logger.info(`[PageLoad] Updated bundle ${bundleId} status to ${bundleStatus} (waves: ${waves.length}, inProgress: ${anyInProgress}, failed: ${anyFailed}, allCompleted: ${allCompleted})`);
  } catch (e: any) {
    logger.warn(`[PageLoad] Failed to update bundle status for ${bundleId}: ${String(e?.message || e)}`);
  }
}

export const load = restrict(
  async ({ params, locals, depends }) => {
    // Mark this load for client-side invalidation when devices are added/removed
    depends('app:bundle');
    const { id } = params;

    try {
      // Fetch the bundle by ID with related data
      const bundle = await locals.prisma.bundle.findUnique({
        where: { id },
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
      
      // Enrich waves with aggregate device counts and progress
      if (bundle && Array.isArray((bundle as any).waves) && (bundle as any).waves.length) {
        const enrichedWaves = [] as any[];
        for (const w of (bundle as any).waves) {
          try {
            const [total, completed, failed] = await Promise.all([
              (locals.prisma as any).bundleDeviceProgress.count({ where: { waveId: w.id } }),
              (locals.prisma as any).bundleDeviceProgress.count({ where: { waveId: w.id, status: 'COMPLETED' } }),
              (locals.prisma as any).bundleDeviceProgress.count({ where: { waveId: w.id, status: 'FAILED' } })
            ]);

            // Wave progress = percentage of devices that have been processed (completed + failed)
            // NOT the average of individual device progress percentages
            const progress = total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
            enrichedWaves.push({ ...w, devicesTotal: total, devicesCompleted: completed, devicesFailed: failed, progress });
          } catch {
            enrichedWaves.push({ ...w, devicesTotal: 0, devicesCompleted: 0, devicesFailed: 0, progress: 0 });
          }
        }
        (bundle as any).waves = enrichedWaves;
      }
      
      // Update bundle status based on all waves
      await updateBundleStatus(locals.prisma, id);
      
      // Fetch bundle devices with device information
      const bundleDevices = await locals.prisma.bundleDevice.findMany({
        where: { bundleId: id },
        include: {
          bundle: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Fetch device information for each bundle device
      const bundleDevicesWithDeviceInfo = await Promise.all(
        bundleDevices.map(async (bundleDevice) => {
          const device = await locals.prisma.device.findUnique({
            where: { id: bundleDevice.deviceId },
            select: {
              id: true,
              name: true,
              model: true,
              status: true
            }
          });
          
          return {
            ...bundleDevice,
            device: device || {
              id: bundleDevice.deviceId,
              name: 'Unknown Device',
              model: 'Unknown',
              status: 'UNKNOWN'
            }
          };
        })
      );
      
      if (!bundle) {
        throw error(404, {
          message: 'Bundle not found',
          code: 'BUNDLE_NOT_FOUND'
        });
      }

      const { currentAccount } = locals;
      
      // Fetch resources (apps) for the bundle apps component
      const resources = await locals.prisma.resource.findMany({
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
      const form = await superValidate(bundle, zod(bundleSchema));
      
      // Add account to bundle for the UI
      const bundleWithAccount = {
        ...bundle,
        account: currentAccount.account
      };
      
      return {
        bundle: bundleWithAccount,
        bundleDevices: bundleDevicesWithDeviceInfo,
        resources,
        form,
        meta: {
          title: `Bundle: ${bundle.name || bundle.id}`,
          description: `Manage bundle details for ${bundle.name || bundle.id}`
        }
      };
    } catch (err) {
      logger.error(`Error loading bundle details: ${err instanceof Error ? err.message : String(err)}`);
      throw error(500, {
        message: 'Failed to load bundle details',
        code: 'BUNDLE_LOAD_ERROR'
      });
    }
  },
  [SystemRole.USER]
);

export const actions: Actions = {
  updateBundle: restrict(
    async ({ params, locals, request }) => {
      const { id } = params;
      
      // Validate form data
      const form = await superValidate(request, zod(bundleSchema));
      
      if (!form.valid) {
        return fail(400, { form });
      }
      
      try {
        // Fetch the existing bundle
        const existingBundle = await locals.prisma.bundle.findUnique({
          where: { id }
        });
        
        if (!existingBundle) {
          throw new FormValidationError(
            'Bundle not found',
            'BUNDLE_NOT_FOUND',
            404
          );
        }
        
        // Get authenticated user info
        const auth = await locals.auth.validate();
        if (!auth?.user) {
          throw new FormValidationError(
            'You must be logged in to update a bundle',
            'AUTH_REQUIRED',
            401
          );
        }

        // Get user info for audit fields
        const userInfo = await locals.prisma.user.findUnique({
          where: { id: auth.user.userId },
          select: { id: true }
        });

        if (!userInfo) {
          throw new FormValidationError(
            'User information not found',
            'USER_NOT_FOUND',
            404
          );
        }

        // Create update object
        const { data } = form;
        const updateData = {
          name: data.name,
          description: data.description || null,
          os: data.os,
          version: data.version,
          reboot: data.reboot || false,
          waveSize: data.waveSize || 500,
          scheduledAt: data.scheduledAt,
          scheduledAtTimezone: data.scheduledAtTimezone || 'UTC',
          scheduledAtStartIfMissed: data.scheduledAtStartIfMissed || false,
          // updateStrategy removed
          updatedBy: userInfo.id
        };

        // Update the bundle
        const updatedBundle = await locals.prisma.bundle.update({
          where: { id },
          data: updateData
        });

        logger.info(`Bundle updated: ${updatedBundle.id}`);

        await logAudit({
            actionType: AuditActionType.UPDATE,
            tableName: 'Bundle',
            recordId: id,
            oldData: existingBundle,
            newData: updatedBundle,
            userId: locals.user.id,
            ipAddress: locals.ipAddress,
            prisma: locals.prisma
        })

        // Return success message
        return message(
          form,
          createSuccessResponse('Bundle updated successfully', {
            details: `Bundle '${updatedBundle.name}' has been updated.`
          })
        );
      } catch (err) {
        return handleFormError(form, err);
      }
    },
    [SystemRole.USER]
  )
};
