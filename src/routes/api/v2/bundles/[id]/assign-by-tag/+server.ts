import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse, ErrorCodes } from '$lib/types/api';
import { logger } from '$lib/server/logger';
import { logAudit } from '$lib/server/audit-logger';
import { AuditActionType } from '$lib/constants/system';

/**
 * POST /api/v2/bundles/[id]/assign-by-tag
 * Add devices to a bundle by selecting tags (devices that have any of the tags and are not already in the bundle).
 * Bundle must be in DRAFT status.
 */
export const POST = unifiedEndpoint(
  async ({ context, params }) => {
    const { prisma, session } = context;
    const { id: bundleId } = params;
    const body = await context.request.json();
    const { tagIds } = body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      throw Object.assign(new Error('Tag IDs array is required'), {
        status: 400,
        code: ErrorCodes.INVALID_INPUT
      });
    }

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      select: { id: true, status: true }
    });

    if (!bundle) {
      throw Object.assign(new Error('Bundle not found'), {
        status: 404,
        code: ErrorCodes.NOT_FOUND
      });
    }

    if (bundle.status !== 'DRAFT') {
      throw Object.assign(
        new Error('Bundle is not editable (must be DRAFT)'),
        { status: 403, code: ErrorCodes.FORBIDDEN }
      );
    }

    const existingDeviceIds = await prisma.bundleDevice
      .findMany({
        where: { bundleId },
        select: { deviceId: true }
      })
      .then((rows) => rows.map((r) => r.deviceId));

    const devices = await prisma.device.findMany({
      where: {
        tags: {
          some: {
            id: { in: tagIds }
          }
        },
        ...(existingDeviceIds.length > 0 ? { id: { notIn: existingDeviceIds } } : {})
      },
      select: { id: true }
    });

    if (devices.length === 0) {
      return successResponse(
        {
          bundleId,
          tagIds,
          assignedCount: 0,
          message: 'No devices found with specified tags (or all are already in the bundle)'
        },
        { requestId: context.requestId }
      );
    }

    const toCreate = devices.map((d) => ({
      bundleId,
      deviceId: d.id,
      status: 'PENDING' as const,
      createdBy: session.user.id,
      updatedBy: session.user.id
    }));

    const result = await prisma.bundleDevice.createMany({
      data: toCreate,
      skipDuplicates: true
    });

    const created = await prisma.bundleDevice.findMany({
      where: {
        bundleId,
        deviceId: { in: devices.map((d) => d.id) }
      }
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

    logger.info(`Bundle assign-by-tag: added ${result.count} device(s) to bundle ${bundleId}`, {
      bundleId,
      tagIds,
      count: result.count,
      userId: session.user.id
    });

    return successResponse(
      {
        bundleId,
        tagIds,
        assignedCount: result.count,
        deviceIds: devices.map((d) => d.id),
        message: `Successfully added ${result.count} device(s) to bundle by tag`
      },
      { requestId: context.requestId }
    );
  },
  { permission: 'bundle.edit', skipPermission: true }
);
