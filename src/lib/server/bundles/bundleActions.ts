import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';
import { FormValidationError } from '$lib/server/errors/FormValidationError';
import { handleFormError } from '$lib/server/errors/errorHandlers';
import { createSuccessResponse } from '$lib/types/api';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';
import { deleteBundle } from '$lib/bundles/server';
import { superValidate, message } from 'sveltekit-superforms/server';
import { zod } from 'sveltekit-superforms/adapters';

/**
 * Create bundle actions factory
 * Per structural standard: create{Resource}Actions pattern
 */
export function createBundleActions(options: {
  checkOwnership?: boolean;
  enableAdvancedFeatures?: boolean;
}): {
  delete: (args: { request: Request; locals: any }) => Promise<any>;
  update: (args: { params: { id: string }; request: Request; locals: any }) => Promise<any>;
  stopAllWaves?: (args: { params: { id: string }; request: Request; locals: any }) => Promise<any>;
} {
  return {
    /**
     * Delete bundle action
     * Used by both list pages (admin and user)
     */
    delete: async ({ request, locals }: { request: Request; locals: any }) => {
      try {
        // Get the bundle ID from form data
        const data = await request.formData();
        const id = data.get('id')?.toString();
        
        if (!id) {
          return fail(400, { error: 'Bundle ID is required' });
        }
        
        const result = await deleteBundle(locals, id);
        if ((result as any).notFound) return fail(404, { error: 'Bundle not found' });
        if ((result as any).cannotDelete) return fail(400, { error: 'Cannot delete a published or in-progress bundle' });
        return { success: true };
      } catch (e: any) {
        logger.error(`Error deleting bundle: ${e?.message || String(e)}`);
        return fail(500, { error: 'Failed to delete bundle' });
      }
    },

    /**
     * Update bundle action
     * Used by both detail pages (admin and user)
     * Admin includes accountId and activePeriodDays if enableAdvancedFeatures is true
     */
    update: async ({ 
      params, 
      request, 
      locals 
    }: { 
      params: { id: string }; 
      request: Request; 
      locals: any 
    }) => {
      const { id } = params;
      
      // Import bundleSchema dynamically
      const { bundleSchema } = await import('../../../routes/admin/iot/bundles/new/bundle');
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
        // Handle both auth.user.id and auth.user.userId (different auth structures)
        const userId = (auth.user as any).id || (auth.user as any).userId;
        const userInfo = await locals.prisma.user.findUnique({
          where: { id: userId },
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
        const updateData: any = {
          name: data.name,
          description: data.description || null,
          os: data.os,
          version: data.version,
          reboot: data.reboot || false,
          waveSize: data.waveSize || 500,
          scheduledAt: data.scheduledAt,
          scheduledAtTimezone: data.scheduledAtTimezone || 'UTC',
          scheduledAtStartIfMissed: data.scheduledAtStartIfMissed || false,
          updatedBy: userInfo.id
        };

        // Admin-only: Include account and active period
        if (options.enableAdvancedFeatures) {
          updateData.accountId = data.accountId;
          updateData.activePeriodDays = Math.min(Math.max(data.activePeriodDays || 1, 1), 30);
        }

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
        });

        // Return success message
        return message(
          form,
          createSuccessResponse('Bundle updated successfully', {
            details: `Bundle '${updatedBundle.name}' has been updated.`
          })
        );
      } catch (err) {
        return handleFormError({
          error: err,
          form,
          prisma: locals.prisma,
          accountId: locals.currentAccount?.id,
          action: 'update bundle'
        });
      }
    },

    /**
     * Stop all waves action (Admin only)
     * Only available when enableAdvancedFeatures is true
     */
    stopAllWaves: options.enableAdvancedFeatures ? async ({ 
      params, 
      locals,
      request 
    }: { 
      params: { id: string }; 
      request: Request;
      locals: any 
    }) => {
      const { id } = params;
      
      try {
        // Get authenticated user info
        const auth = await locals.auth.validate();
        if (!auth?.user) {
          throw new FormValidationError(
            'You must be logged in to stop waves',
            'AUTH_REQUIRED',
            401
          );
        }

        // Get user info for audit fields
        // Handle both auth.user.id and auth.user.userId (different auth structures)
        const userId = (auth.user as any).id || (auth.user as any).userId;
        const userInfo = await locals.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true }
        });

        if (!userInfo) {
          throw new FormValidationError(
            'User information not found',
            'USER_NOT_FOUND',
            404
          );
        }

        // Fetch the bundle and its waves
        const bundle = await locals.prisma.bundle.findUnique({
          where: { id },
          include: {
            waves: {
              orderBy: { createdAt: 'asc' }
            }
          }
        });

        if (!bundle) {
          throw new FormValidationError(
            'Bundle not found',
            'BUNDLE_NOT_FOUND',
            404
          );
        }

        // Check if there are any active waves
        const activeWaves = bundle.waves.filter((wave: any) => 
          wave.status === 'IN_PROGRESS' || wave.status === 'PENDING'
        );

        if (activeWaves.length === 0) {
          return fail(400, { 
            error: 'No active waves to stop',
            message: 'There are no waves currently in progress or pending'
          });
        }

        // Update all pending waves to CANCELLED status
        // This allows the current IN_PROGRESS wave to complete normally
        // but prevents subsequent waves from starting
        const pendingWaves = bundle.waves.filter((wave: any) => wave.status === 'PENDING');
        
        if (pendingWaves.length > 0) {
          await locals.prisma.bundleWave.updateMany({
            where: {
              id: { in: pendingWaves.map((w: any) => w.id) }
            },
            data: {
              status: 'CANCELLED',
              updatedBy: userInfo.id
            }
          });

          logger.info(`Stopped ${pendingWaves.length} pending waves for bundle ${id}`);

          // Log audit for each cancelled wave
          for (const wave of pendingWaves) {
            await logAudit({
              actionType: AuditActionType.UPDATE,
              tableName: 'BundleWave',
              recordId: wave.id,
              oldData: wave,
              newData: { ...wave, status: 'CANCELLED' },
              userId: userInfo.id,
              ipAddress: locals.ipAddress,
              prisma: locals.prisma
            });
          }
        }

        // Check if there's a wave currently running
        const currentRunningWave = bundle.waves.find((wave: any) => wave.status === 'IN_PROGRESS');
        
        if (currentRunningWave) {
          // If there's a wave running, keep bundle status as IN_PROGRESS
          // Let the current wave complete normally
          // The real-time system will update to CANCELLED when the wave finishes
          logger.info(`Bundle ${id} - wave is running, keeping status as IN_PROGRESS until wave completes`);
        } else {
          // If no wave is running, update bundle status to CANCELLED immediately
          await locals.prisma.bundle.update({
            where: { id },
            data: {
              status: 'CANCELLED',
              updatedBy: userInfo.id
            }
          });

          await logAudit({
            actionType: AuditActionType.UPDATE,
            tableName: 'Bundle',
            recordId: id,
            oldData: bundle,
            newData: { ...bundle, status: 'CANCELLED' },
            userId: userInfo.id,
            ipAddress: locals.ipAddress,
            prisma: locals.prisma
          });

          logger.info(`Bundle ${id} status updated to CANCELLED - no waves running`);
        }

        return {
          success: true,
          message: `Successfully stopped ${pendingWaves.length} pending waves. Current wave will complete normally.`,
          cancelledWaves: pendingWaves.length
        };

      } catch (err) {
        logger.error(`Error stopping waves for bundle ${id}: ${String(err)}`);
        return fail(500, { 
          error: 'Failed to stop waves',
          message: 'An error occurred while stopping the waves'
        });
      }
    } : undefined
  };
}

