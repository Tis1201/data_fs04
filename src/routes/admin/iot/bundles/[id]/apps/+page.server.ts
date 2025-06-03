import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

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
          }
        }
      });
      
      if (!bundle) {
        throw error(404, {
          message: 'Bundle not found',
          code: 'BUNDLE_NOT_FOUND'
        });
      }
      
      return {
        bundle,
        meta: {
          title: `Bundle Apps: ${bundle.name || bundle.id}`,
          description: `Manage apps for bundle ${bundle.name || bundle.id}`
        }
      };
    } catch (err) {
      logger.error(`Error loading bundle apps: ${err instanceof Error ? err.message : String(err)}`);
      throw error(500, {
        message: 'Failed to load bundle apps',
        code: 'BUNDLE_APPS_LOAD_ERROR'
      });
    }
  },
  [SystemRole.ADMIN]
);
