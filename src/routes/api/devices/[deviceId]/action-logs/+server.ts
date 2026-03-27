import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

/**
 * API endpoint for fetching action logs for a device.
 * Used by ActionLogSyncManager to resync when sequence gaps are detected.
 */
export const GET: RequestHandler = restrict(
  async (event: AuthenticatedEvent) => {
    const { params, url, locals } = event;
    const { deviceId } = params;
    const { prisma } = locals;

    if (!deviceId) {
      throw error(400, 'Device ID is required');
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    try {
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
        select: { 
          id: true,
          createdBy: true,
          accountId: true
        }
      });

      if (!device) {
        throw error(404, 'Device not found');
      }

      const userId = event.auth?.user?.id;
      const systemRole = event.auth?.user?.systemRole;
      const isSystemAdmin = systemRole === SystemRole.ADMIN || systemRole === SystemRole.SUPER_ADMIN;
      const isCreator = device.createdBy === userId;

      let isAccountMember = false;
      if (!isSystemAdmin && !isCreator && device.accountId && userId) {
        const membership = await prisma.accountMembership.findFirst({
          where: {
            userId,
            accountId: device.accountId,
            role: { not: 'SYSTEM' }
          }
        });
        isAccountMember = !!membership;
      }

      if (!isSystemAdmin && !isCreator && !isAccountMember) {
        throw error(403, 'Access denied');
      }

      const logs = await prisma.deviceActionLog.findMany({
        where: { deviceId },
        orderBy: { initiatedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true
            }
          },
          device: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      const transformedLogs = logs.map(log => ({
        id: log.id,
        deviceId: log.deviceId,
        actionType: log.actionType,
        status: log.status,
        progress: log.progress,
        initiatedAt: log.initiatedAt.toISOString(),
        completedAt: log.completedAt?.toISOString() || null,
        durationMs: log.durationMs,
        message: log.message,
        error: log.error,
        user: log.user ? {
          id: log.user.id,
          name: log.user.name
        } : null,
        sequenceNumber: log.sequenceNumber
      }));

      return json({
        success: true,
        data: {
          logs: transformedLogs,
          total: transformedLogs.length,
          deviceId
        }
      });
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err) {
        throw err;
      }
      console.error('[API] Failed to fetch action logs', {
        deviceId,
        error: err instanceof Error ? err.message : String(err)
      });
      throw error(500, 'Failed to fetch action logs');
    }
  },
  [SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.USER]
);
