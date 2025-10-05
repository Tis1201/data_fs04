import { redirect } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = restrict(
  async ({ params, locals, auth }: any) => {
    try {
      // Fetch the pin rule and ensure user has access
      const rule = await locals.prisma.pinRule.findUnique({
        where: { id: params.id },
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          account: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      });

      if (!rule) {
        throw redirect(302, '/user/iot/pin-rules');
      }

      // Check if user has access to this rule
      // User can edit their own rules or admin_default rules
      if (rule.createdBy !== auth.user.id && rule.ruleType !== 'admin_default') {
        throw redirect(302, '/user/iot/pin-rules');
      }

      return {
        user: auth.user,
        rule
      };
    } catch (error) {
      console.error('Error loading pin rule:', error);
      throw redirect(302, '/user/iot/pin-rules');
    }
  },
  ['USER'] // Restrict to regular users
);
