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

    const claims = preclaimSet.claims ?? [];
    // Compute metrics with safe fallbacks
    const total = claims.length;
    const claimed = claims.filter((c: any) => {
      const status = (c?.status ?? '').toString().toUpperCase();
      return !!c?.claimedAt || status === 'CLAIMED' || status === 'USED' || status === 'ASSIGNED';
    }).length;
    const left = Math.max(0, total - claimed);

    return {
      preclaimSet,
      claims,
      metrics: {
        total,
        claimed,
        left
      },
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
