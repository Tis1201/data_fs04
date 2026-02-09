import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { areDevicesOnline } from '$lib/server/device/devicePresence';

/**
 * GET /api/v2/bundles/[id]/devices/available
 * List devices that can be added to this bundle (not already in bundle).
 * Same response shape as GET /api/v2/device-profiles/[id]/devices for reuse in DeviceSelector.
 *
 * Query params: limit, offset, search (same as device-profiles)
 */
export const GET = unifiedEndpoint(
  async ({ context, event, params }) => {
    const { prisma } = context;
    const { id: bundleId } = params;
    const url = event.url;

    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || '10')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
    const search = (url.searchParams.get('search') || '').trim();

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      select: { id: true, status: true }
    });

    if (!bundle) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Bundle not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Same as components/device_select: no account filter – list all ACTIVE devices not already in bundle
    const where: any = { status: 'ACTIVE' };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { macAddress: { contains: search, mode: 'insensitive' } },
        { deviceType: { contains: search, mode: 'insensitive' } }
      ];
    }

    const existingDeviceIds = await prisma.bundleDevice
      .findMany({
        where: { bundleId },
        select: { deviceId: true }
      })
      .then((rows) => rows.map((r: { deviceId: string }) => r.deviceId));
    if (existingDeviceIds.length > 0) {
      where.id = { notIn: existingDeviceIds };
    }

    const [devices, total] = await Promise.all([
      prisma.device.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          model: true,
          description: true,
          connected: true,
          createdAt: true,
          updatedAt: true,
          profileAssignment: {
            select: {
              profileId: true,
              status: true,
              profile: { select: { id: true, name: true, level: true, accountId: true } }
            }
          }
        }
      }),
      prisma.device.count({ where })
    ]);

    const presenceMap = await areDevicesOnline(devices.map((d: { id: string }) => d.id));
    const devicesWithPresence = devices.map((d: any) => ({
      ...d,
      connected: presenceMap.get(d.id) ?? false
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          devices: devicesWithPresence,
          total,
          pagination: {
            limit,
            offset,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.max(1, Math.ceil(total / limit)),
            totalCount: total
          }
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },
  { permission: 'bundle.edit', skipPermission: true }
);
