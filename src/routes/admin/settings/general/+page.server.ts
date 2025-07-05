import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { z } from 'zod';
import { zod } from 'sveltekit-superforms/adapters';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import prisma from '$lib/server/prisma'; // Raw Prisma client to bypass ZenStack
import { getCurrentActiveSetting, updateActiveSetting } from '$lib/server/settings';

// Schema for settings form
const settingsSchema = z.object({
  id: z.string().optional(),
  data: z.string().min(2, 'Settings data is required'),
});

export const load = restrict(
  async (event: AuthenticatedEvent) => {
    const { locals, auth } = event;
    
    try {
      // Get the currently active settings (ensures one exists)
      const activeSettings = await getCurrentActiveSetting();

      // Get settings history
      const settingsHistory = await prisma.setting.findMany({
        where: {
          isActive: false,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 10, // Limit to last 10 entries
      });

      // Create form with existing data
      const form = await superValidate(
        { id: activeSettings.id, data: activeSettings.data || '{}' }, 
        zod(settingsSchema)
      );

      return {
        form,
        activeSettings,
        settingsHistory,
      };
    } catch (err) {
      logger.error('Error loading settings:', err as Record<string, any>);
      throw error(500, 'Failed to load settings');
    }
  },
  [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
  update: restrict(
    async (event: AuthenticatedEvent) => {
      const { request, locals, auth } = event;
      
      // Auth should never be null here due to restrict guard, but TypeScript doesn't know this
      if (!auth?.user) {
        throw error(401, 'Unauthorized');
      }
      
      const form = await superValidate(request, zod(settingsSchema));
      
      if (!form.valid) {
        return fail(400, { form });
      }

      try {
        // Use the utility function to update settings atomically
        await updateActiveSetting(form.data.data, auth.user.id || 'system');
        
        logger.info(`Settings updated by user: ${auth.user.id || 'system'} (${auth.user.systemRole})`);
        
        return message(form, {
          type: 'success',
          text: 'Settings updated successfully',
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        logger.error('Error updating settings:', e as Record<string, any>);
        
        if (e instanceof SyntaxError) {
          return message(form, {
            type: 'error',
            text: 'Invalid JSON format',
            details: 'Please check your settings format and try again.',
            code: 'INVALID_JSON',
            timestamp: new Date().toISOString()
          }, { status: 400 });
        }
        
        return message(form, {
          type: 'error',
          text: 'Failed to update settings',
          details: e instanceof Error ? e.message : 'An unexpected error occurred',
          code: 'UPDATE_FAILED',
          timestamp: new Date().toISOString()
        }, { status: 500 });
      }
    },
    [SystemRole.ADMIN]
  )
};
