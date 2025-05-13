import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate } from 'sveltekit-superforms/server';
import { z } from 'zod';
import { zod } from 'sveltekit-superforms/adapters';

// Schema for settings form
const settingsSchema = z.object({
  id: z.string().optional(),
  data: z.string().min(2, 'Settings data is required'),
});

export const load: PageServerLoad = async ({ locals }) => {
  // Get the currently active settings
  const activeSettings = await locals.prisma.setting.findFirst({
    where: {
      isActive: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  // Get settings history
  const settingsHistory = await locals.prisma.setting.findMany({
    where: {
      isActive: false,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 10, // Limit to last 10 entries
  });

  // Create form with empty data or existing data
  const form = await superValidate(
    activeSettings 
      ? { id: activeSettings.id, data: activeSettings.data || '{}' } 
      : { data: '{}' }, 
    zod(settingsSchema)
  );

  return {
    form,
    activeSettings,
    settingsHistory,
  };
};

export const actions: Actions = {
  update: async ({ request, locals }) => {
    const form = await superValidate(request, zod(settingsSchema));
    
    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      // Parse JSON to validate it's proper JSON
      JSON.parse(form.data.data);
      
      // If there's an existing active setting, deactivate it
      if (form.data.id) {
        await locals.prisma.setting.update({
          where: { id: form.data.id },
          data: { isActive: false }
        });
      }
      
      // Create a new active setting
      await locals.prisma.setting.create({
        data: {
          data: form.data.data,
          isActive: true,
          createdBy: locals.user?.id || 'system',
          updatedBy: locals.user?.id || 'system',
        }
      });
      
      return { form };
    } catch (e) {
      console.error('Error updating settings:', e);
      return fail(400, { 
        form,
        error: e instanceof Error ? e.message : 'Invalid JSON data'
      });
    }
  }
};
