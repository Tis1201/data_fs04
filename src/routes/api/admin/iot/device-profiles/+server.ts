import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin users have full access
    if (auth.user.systemRole !== 'ADMIN') {
      return json({ error: 'Admin access required' }, { status: 403 });
    }

    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};

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
        updatedBy: true,
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

    console.log("where", where)
    console.log("total", total)

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

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin users have full access
    if (auth.user.systemRole !== 'ADMIN') {
      return json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, settings, accountId } = body;

    // Validate required fields
    if (!name || !settings || !Array.isArray(settings)) {
      return json({ error: 'Name and settings are required' }, { status: 400 });
    }

    // Validate accountId for admin creation
    if (!accountId) {
      return json({ error: 'Account ID is required for admin profile creation' }, { status: 400 });
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
