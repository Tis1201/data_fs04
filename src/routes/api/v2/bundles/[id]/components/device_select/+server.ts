import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';
import { areDevicesOnline } from '$lib/server/device/devicePresence';

/**
 * GET /api/v2/bundles/[id]/components/device_select
 * Get available devices for selection (excludes already-added devices)
 * 
 * This is a UI helper endpoint that:
 * - Fetches devices suitable for bundle assignment
 * - Excludes devices already in the bundle
 * - Supports pagination, search, filtering by status/tag
 * - Includes online status
 * 
 * Query params:
 * - page: number (default: 1)
 * - per_page: number (default: 5)
 * - search: string
 * - sort: string (default: 'name')
 * - order: 'asc' | 'desc' (default: 'asc')
 * - status: string
 * - tag: string (tag ID)
 */
export const GET = unifiedEndpoint(
  async ({ context, event, params }) => {
    const { prisma } = context;
    const { id: bundleId } = params;
    const url = event.url;

    // Get query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '5');
    const sort = url.searchParams.get('sort') || 'name';
    const order = (url.searchParams.get('order') || 'asc') as 'asc' | 'desc';
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const tag = url.searchParams.get('tag') || '';

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { macAddress: { contains: search, mode: 'insensitive' } },
        { wifiMac: { contains: search, mode: 'insensitive' } },
        { lanMac: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = {
        some: {
          id: tag
        }
      };
    }

    // Exclude devices already in this bundle
    const existing = await prisma.bundleDevice.findMany({
      where: { bundleId },
      select: { deviceId: true }
    });
    const excludedDeviceIds = existing.map((e: { deviceId: string }) => e.deviceId);

    if (excludedDeviceIds.length > 0) {
      where.id = { notIn: excludedDeviceIds };
    }

    // Get total count
    const total = await prisma.device.count({ where });

    // Get devices
    const devices = await prisma.device.findMany({
      where,
      select: {
        id: true,
        name: true,
        model: true,
        status: true,
        connected: true,
        macAddress: true,
        tags: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { [sort]: order },
      skip: (page - 1) * perPage,
      take: perPage
    });

    // Check online status
    const deviceIds = devices.map((d: { id: string }) => d.id);
    const onlineStatuses = await areDevicesOnline(deviceIds);

    const records = devices.map((device: any) => ({
      ...device,
      online: onlineStatuses.get(device.id) || false
    }));

    const totalPages = Math.ceil(total / perPage);

    return successResponse({
      records,
      meta: {
        pagination: {
          current_page: page,
          per_page: perPage,
          total_records: total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1
        }
      }
    });
  },
  { permission: 'bundle.edit' }
);

