import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';

export const load = restrict(async ({ params, locals, depends }: any) => {
  depends('app:preclaim');
  const { id } = params;

  try {
    const preclaimSet = await (locals.prisma as any).preclaimSet.findUnique({
      where: { id },
      include: {
        claims: true,
        account: {
          select: { id: true, name: true }
        },
        profile: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true
          }
        }
      }
    });

    if (!preclaimSet) {
      throw error(404, 'Pre-claim set not found');
    }

    // Attach creator user (model stores only createdBy string)
    const creator = preclaimSet?.createdBy
      ? await (locals.prisma as any).user.findUnique({
          where: { id: preclaimSet.createdBy },
          select: { id: true, name: true, email: true }
        })
      : null;

    // Debug logging
    logger.info(`Preclaim set ${id} creator lookup:`, {
      createdBy: preclaimSet?.createdBy,
      creatorFound: !!creator,
      creatorName: creator?.name,
      creatorEmail: creator?.email
    });

    // Add fallback display name for creator
    const creatorDisplayName = creator?.name || creator?.email || 'Unknown';
    const preclaimSetOut = { 
      ...preclaimSet, 
      user: creator ? { ...creator, displayName: creatorDisplayName } : null 
    };

    const claims = preclaimSet.claims ?? [];
    // Compute metrics with safe fallbacks
    const total = claims.length;
    const claimed = claims.filter((c: any) => {
      const status = (c?.status ?? '').toString().toUpperCase();
      return !!c?.claimedAt || status === 'CLAIMED' || status === 'USED' || status === 'ASSIGNED';
    }).length;
    const left = Math.max(0, total - claimed);

    return {
      preclaimSet: preclaimSetOut,
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
    throw error(500, 'Failed to load pre-claim set details');
  }
}, [SystemRole.ADMIN]) satisfies PageServerLoad;
