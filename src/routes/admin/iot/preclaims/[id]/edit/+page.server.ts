import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms/server';
import { preclaimSetEditSchema } from '../schema';
import { zod } from 'sveltekit-superforms/adapters';
import { logger } from '$lib/server/logger';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { AuditActionType } from '$lib/constants/system';
import { logAudit } from '$lib/server/audit-logger';
import { createSuccessResponse } from '$lib/types/api';

export const load = restrict(
  async ({ params, locals }) => {
    const id = params.id;
    try {
      const preclaimSet = await locals.prisma.preclaimSet.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
          accountId: true,
          profileId: true,
          profile: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      });

      if (!preclaimSet) {
        throw error(404, 'Pre-claim set not found');
      }

      // Load available device profiles (GLOBAL level only)
      const profiles = await locals.prisma.deviceProfile.findMany({
        where: {
          isActive: true,
          level: 'GLOBAL'
        },
        select: {
          id: true,
          name: true,
          description: true,
          accountId: true,
          account: {
            select: { name: true }
          }
        },
        orderBy: { name: 'asc' }
      });

      const profileOptions = profiles.map(profile => ({
        value: profile.id,
        label: `${profile.name} (${profile.account.name})`,
        description: profile.description,
        accountId: profile.accountId
      }));

      const form = await superValidate(
        {
          id: preclaimSet.id,
          name: preclaimSet.name,
          description: preclaimSet.description ?? '',
          status: preclaimSet.status,
          expiresAt: preclaimSet.expiresAt ? new Date(preclaimSet.expiresAt).toISOString().slice(0, 16) : null,
          profileId: preclaimSet.profileId ?? null,
        },
        zod(preclaimSetEditSchema)
      );

      return { form, preclaimSet, profileOptions };
    } catch (e) {
      logger.error('Error loading pre-claim set for edit:', e);
      throw error(500, 'Failed to load pre-claim set');
    }
  },
  [SystemRole.ADMIN]
) satisfies PageServerLoad;

export const actions: Actions = {
  save: restrict(
    async ({ request, params, locals }) => {
      const id = params.id;
      const form = await superValidate(request, zod(preclaimSetEditSchema));
      logger.debug(`Preclaim set edit form data: ${JSON.stringify(form)}`);

      if (!form.valid) {
        return fail(400, { form });
      }

      try {
        const existing = await locals.prisma.preclaimSet.findUnique({ where: { id } });
        if (!existing) {
          return fail(404, { form, error: 'Pre-claim set not found' });
        }

        let expiresAt: Date | null = null;
        const expiresStr = form.data.expiresAt?.toString().trim();
        if (expiresStr) {
          const parsed = new Date(expiresStr);
          expiresAt = isNaN(parsed.getTime()) ? null : parsed;
        }

        const updateData = {
          name: form.data.name,
          description: form.data.description || null,
          status: form.data.status,
          expiresAt,
          profileId: form.data.profileId || null,
        };

        const updated = await locals.prisma.preclaimSet.update({
          where: { id },
          data: updateData
        });

        await logAudit({
          actionType: AuditActionType.UPDATE,
          tableName: 'PreclaimSet',
          recordId: id,
          oldData: existing,
          newData: updated,
          userId: locals.user.id,
          ipAddress: locals.ipAddress,
          prisma: locals.prisma
        });

        return message(
          form,
          createSuccessResponse('Pre-claim set updated successfully!', {
            details: `Pre-claim set '${updated.name}' has been updated.`,
            data: { id: updated.id, name: updated.name }
          })
        );
      } catch (e) {
        logger.error('Error updating pre-claim set:', e);
        return fail(500, { form, error: 'Failed to update pre-claim set' });
      }
    },
    [SystemRole.ADMIN]
  ),

  cancel: restrict(
    async ({ params }) => {
      throw redirect(303, `/admin/iot/preclaims/${params.id}`);
    },
    [SystemRole.ADMIN]
  )
};
