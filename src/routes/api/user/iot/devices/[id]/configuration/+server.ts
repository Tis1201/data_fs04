import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { loadDeviceProfile } from '$lib/server/device/deviceProfileLoader';

const MAX_PER_PAGE = 50;

/**
 * GET /api/user/iot/devices/[id]/configuration
 *
 * Loads merged device profile config plus assignable profiles for the Configuration tab / Edit Device modal.
 * Global templates are paginated (default 50 per page); device-level self profile is always included on page 1.
 *
 * Query: page (default 1), per_page (default 50, max 50), search (optional, global names only)
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
    try {
        const deviceId = params.id;
        if (!deviceId) {
            return json({ success: false, error: 'Device ID is required' }, { status: 400 });
        }

        const auth = await locals.auth.validate();
        if (!auth?.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const currentAccountId = (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id;
        if (!currentAccountId) {
            return json({ success: false, error: 'Account required' }, { status: 403 });
        }

        const device = await locals.prisma.device.findFirst({
            where: { id: deviceId, accountId: currentAccountId },
            select: { id: true }
        });
        if (!device) {
            return json({ success: false, error: 'Device not found' }, { status: 404 });
        }

        const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
        const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number(url.searchParams.get('per_page') || String(MAX_PER_PAGE))));
        const search = (url.searchParams.get('search') || '').trim();

        const deviceProfile = await loadDeviceProfile(locals.prisma, deviceId);

        const selfSelect = {
            id: true,
            name: true,
            description: true,
            level: true,
            deviceId: true
        } as const;

        const selfRows =
            page === 1
                ? await locals.prisma.deviceProfile.findMany({
                      where: {
                          isActive: true,
                          level: 'DEVICE',
                          deviceId,
                          accountId: currentAccountId
                      },
                      select: selfSelect,
                      orderBy: { name: 'asc' as const }
                  })
                : [];

        const globalWhere: Record<string, unknown> = {
            isActive: true,
            level: 'GLOBAL',
            accountId: currentAccountId
        };
        if (search) {
            globalWhere.name = { contains: search, mode: 'insensitive' };
        }

        const [globalTotal, globalRows] = await Promise.all([
            locals.prisma.deviceProfile.count({ where: globalWhere as any }),
            locals.prisma.deviceProfile.findMany({
                where: globalWhere as any,
                orderBy: { name: 'asc' },
                skip: (page - 1) * perPage,
                take: perPage,
                select: selfSelect
            })
        ]);

        const lastPage = Math.max(1, Math.ceil(globalTotal / perPage));

        return json({
            success: true,
            deviceProfile,
            assignableProfiles: {
                self: selfRows,
                globals: globalRows,
                meta: {
                    current_page: page,
                    per_page: perPage,
                    total: globalTotal,
                    last_page: lastPage
                }
            }
        });
    } catch (err) {
        return errorHandler(err);
    }
};
