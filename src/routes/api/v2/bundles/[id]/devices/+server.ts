import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/bundles/[id]/devices
 * Add device(s) to a bundle.
 *
 * Body (single): { deviceId: string, status?: string }
 * Body (bulk):   { deviceIds: string[], status?: string }
 *
 * Restrictions: Bundle must be DRAFT; devices must exist and not already be in the bundle.
 */
export const POST = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;
    const body = await context.request.json();
    const deviceIds = Array.isArray(body?.deviceIds) ? body.deviceIds : body?.deviceId ? [body.deviceId] : [];
    const status = body?.status ?? 'PENDING';

    if (deviceIds.length === 0) {
      throw Object.assign(
        new Error('deviceId or deviceIds is required'),
        { status: 400, code: ErrorCodes.INVALID_INPUT }
      );
    }

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId }
    });

    if (!bundle) {
      throw Object.assign(
        new Error('Bundle not found'),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    if (bundle.status !== 'DRAFT') {
      throw Object.assign(
        new Error('Bundle is not editable (must be DRAFT)'),
        { status: 403, code: ErrorCodes.FORBIDDEN }
      );
    }

    const existing = await prisma.bundleDevice.findMany({
      where: { bundleId, deviceId: { in: deviceIds } },
      select: { deviceId: true }
    });
    const alreadyInBundle = new Set(existing.map((r: { deviceId: string }) => r.deviceId));
    const toAdd = deviceIds.filter((id: string) => !alreadyInBundle.has(id));

    if (toAdd.length === 0) {
      throw Object.assign(
        new Error('All selected devices are already in this bundle'),
        { status: 409, code: ErrorCodes.CONFLICT }
      );
    }

    const existingDevices = await prisma.device.findMany({
      where: { id: { in: toAdd } },
      select: { id: true }
    });
    const existingIds = new Set(existingDevices.map((d: { id: string }) => d.id));
    const missing = toAdd.filter((id: string) => !existingIds.has(id));
    if (missing.length > 0) {
      throw Object.assign(
        new Error(`Device(s) not found: ${missing.join(', ')}`),
        { status: 404, code: ErrorCodes.NOT_FOUND }
      );
    }

    const toCreate = toAdd.map((deviceId: string) => ({
      bundleId,
      deviceId,
      status,
      createdBy: session.user.id,
      updatedBy: session.user.id
    }));

    const result = await prisma.bundleDevice.createMany({
      data: toCreate,
      skipDuplicates: true
    });

    const created = await prisma.bundleDevice.findMany({
      where: { bundleId, deviceId: { in: toAdd } }
    });

    for (const bd of created) {
      await logAudit({
        actionType: AuditActionType.INSERT,
        tableName: 'BundleDevice',
        recordId: bd.id,
        oldData: null,
        newData: bd,
        userId: session.user.id,
        ipAddress: context.ipAddress,
        prisma
      });
    }

    logger.info(`Added ${result.count} device(s) to bundle ${bundleId} by user ${session.user.id}`);

    return successResponse(
      {
        bundleDevices: created,
        addedCount: result.count,
        ...(created.length === 1 ? { bundleDevice: created[0] } : {})
      },
      { message: result.count === 1 ? 'Device added to bundle successfully' : `${result.count} devices added to bundle successfully` }
    );
  },
  { permission: 'bundle.edit', skipPermission: true }
);
