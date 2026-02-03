import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { json } from '@sveltejs/kit';
import rawPrisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { requirePermission } from '$lib/server/security/permissions';
import { ErrorCodes } from '$lib/types/api';
import { successResponse } from '$lib/types/api';

/**
 * DELETE /api/v2/preclaims/[id]/devices/[recordId]
 * Remove a device (preclaim record) from the preclaim set.
 * Allowed for any status (PENDING, FULFILLED, EXPIRED).
 */
export const DELETE = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, permissionUser } = context;
    const { id: setId, recordId } = params;

    const preclaimSet = await prisma.preclaimSet.findFirst({
      where: { id: setId },
      select: { id: true, accountId: true }
    });
    if (!preclaimSet) {
      throw Object.assign(new Error('Pre-claim set not found'), { status: 404, code: ErrorCodes.NOT_FOUND });
    }
    await requirePermission(permissionUser, 'preclaim.edit', preclaimSet);

    const record = await rawPrisma.preclaimDevice.findFirst({
      where: { id: recordId, setId }
    });
    if (!record) {
      throw Object.assign(new Error('Device record not found in this pre-claim set'), {
        status: 404,
        code: ErrorCodes.NOT_FOUND
      });
    }

    await rawPrisma.preclaimDevice.delete({ where: { id: recordId } });
    logger.info(`[preclaims/devices] Removed preclaim device ${recordId} from set ${setId}`);

    return json(successResponse({ removed: true }));
  },
  {}
);
