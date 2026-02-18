import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const where: any = {};
    const currentAccountId =
      (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
      cookies.get('current_account_id');
    if (currentAccountId) {
      where.accountId = currentAccountId;
    } else {
      const userAccountMemberships = await locals.prisma.accountMembership.findMany({
        where: { userId: auth.user.id },
        select: { accountId: true }
      });
      const accountIds = userAccountMemberships.map(m => m.accountId);
      where.accountId = accountIds.length > 0 ? { in: accountIds } : null;
    }
    if (where.accountId == null) {
      return json({ success: true, profiles: [], total: 0, pagination: { limit, offset, hasMore: false } });
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'inactive') {
        where.isActive = false;
      }
    }

    // Get device profiles from database
    const profiles = await locals.prisma.deviceProfile.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        account: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            assignments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await locals.prisma.deviceProfile.count({ where });

    return json({
      success: true,
      profiles,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, settings } = body;

    // Validate required fields
    if (!name || !settings || !Array.isArray(settings)) {
      return json({ error: 'Name and settings are required' }, { status: 400 });
    }

    const postAccountId =
      (locals as { currentAccount?: { account?: { id: string } } }).currentAccount?.account?.id ??
      cookies.get('current_account_id');
    let accountId = postAccountId;
    if (!accountId) {
      const membership = await locals.prisma.accountMembership.findFirst({
        where: { userId: auth.user.id, role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } },
        select: { accountId: true }
      });
      accountId = membership?.accountId ?? undefined;
    }
    if (!accountId) {
      return json({ error: 'No account access found' }, { status: 403 });
    }

    // Create device profile with settings
    const profile = await locals.prisma.deviceProfile.create({
      data: {
        name,
        description,
        accountId,
        createdBy: auth.user.id,
        settings: {
          create: settings.map((setting: any, index: number) => ({
            key: setting.key,
            value: setting.value,
            dataType: setting.dataType,
            label: setting.label,
            category: setting.category,
            order: setting.order || index
          }))
        }
      },
      include: {
        settings: true,
        account: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return json({
      success: true,
      profile
    });

  } catch (error) {
    return errorHandler(error);
  }
};
