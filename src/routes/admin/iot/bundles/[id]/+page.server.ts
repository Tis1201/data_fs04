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

export const load = restrict(
  async ({ params, locals }) => {
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
      
      // Fetch account info separately if accountId is present
      let account = null;
      if (bundle?.accountId) {
        account = await locals.prisma.account.findUnique({
          where: { id: bundle.accountId },
          select: {
            id: true,
            name: true
          }
        });
      }
      
      if (!bundle) {
        throw error(404, {
          message: 'Bundle not found',
          code: 'BUNDLE_NOT_FOUND'
        });
      }

      // Fetch accounts for the dropdown
      const accounts = await locals.prisma.account.findMany({
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      
      // Fetch resources (apps) for the bundle apps component
      const resources = await locals.prisma.resource.findMany({
        where: {
          type: 'APK' // Assuming we're only interested in APK resources
        },
        select: {
          id: true,
          name: true
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
        account
      };
      
      return {
        bundle: bundleWithAccount,
        accounts,
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
  [SystemRole.ADMIN]
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
          updateStrategy: data.updateStrategy || 'IMMEDIATE',
          accountId: data.accountId,
          updatedBy: userInfo.id
        };

        // Update the bundle
        const updatedBundle = await locals.prisma.bundle.update({
          where: { id },
          data: updateData
        });

        logger.info(`Bundle updated: ${updatedBundle.id}`);

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
    [SystemRole.ADMIN]
  )
};
