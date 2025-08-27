import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

export const load = restrict(async ({ params, locals, depends }) => {
  depends('app:preclaim');
  const { id } = params;

  try {
    const preclaimSet = await (locals.prisma as any).preclaimSet.findUnique({
      where: { id },
      include: {
        claims: true
      }
    });

    if (!preclaimSet) {
      throw error(404, {
        message: 'Pre-claim set not found',
        code: 'PRECLAIM_SET_NOT_FOUND'
      });
    }

    return {
      preclaimSet,
      claims: preclaimSet.claims ?? [],
      meta: {
        title: `Pre-claim Set: ${preclaimSet.name || preclaimSet.id}`,
        description: `View details for pre-claim set ${preclaimSet.name || preclaimSet.id}`
      }
    };
  } catch (err) {
    logger.error(`Error loading pre-claim set: ${err instanceof Error ? err.message : String(err)}`);
    throw error(500, {
      message: 'Failed to load pre-claim set details',
      code: 'PRECLAIM_SET_LOAD_ERROR'
    });
  }
}, [SystemRole.USER]) satisfies PageServerLoad;
