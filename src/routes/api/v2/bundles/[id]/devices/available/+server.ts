import { error } from '@sveltejs/kit';
import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { areDevicesOnline } from '$lib/server/device/devicePresence';
import { getDeviceTypeFilterForBundleOs } from '$lib/utils/bundleUtils';

/**
 * GET /api/v2/bundles/[id]/devices/available
 * List devices that can be added to this bundle.
 * Shows all account devices (devices already in this bundle can still be in other bundles; UI can show "Already added").
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
      select: { id: true, status: true, os: true }
    });

    if (!bundle) {
      throw error(404, 'Bundle not found');
    }
    console.log('[devices/available] bundleId:', bundleId, 'bundle found:', !!bundle);

    const where: any = { status: 'ACTIVE' };

    // Filter by bundle target OS (darwin matches MacOS, case-insensitive)
    const bundleOs = (bundle as { os?: string | null }).os;
    const osFilter = getDeviceTypeFilterForBundleOs(bundleOs);
    if (osFilter) Object.assign(where, osFilter);

    const isAdmin = context.session?.user?.systemRole === 'ADMIN';
    if (!isAdmin && context.account?.id) {
      where.accountId = context.account.id;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
        { macAddress: { contains: search, mode: 'insensitive' } },
        { deviceType: { contains: search, mode: 'insensitive' } }
      ];
    }
    console.log('[devices/available] where:', JSON.stringify(where, null, 2));
    console.log('[devices/available] isAdmin:', isAdmin, 'accountId:', context.account?.id);

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
    console.log('[devices/available] total:', total, 'devices.length:', devices.length);
    if (devices.length > 0) {
      console.log('[devices/available] first device:', devices[0].id, devices[0].name);
    }

    const presenceMap = await areDevicesOnline(devices.map((d: { id: string }) => d.id));
    const devicesWithPresence = devices.map((d: any) => ({
      ...d,
      connected: presenceMap.get(d.id) ?? false
    }));

    // Return plain object so unifiedEndpoint can do json(result); returning Response would be serialized as {}
    return {
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
    };
  },
  { permission: 'bundle.edit', skipPermission: true }
);
