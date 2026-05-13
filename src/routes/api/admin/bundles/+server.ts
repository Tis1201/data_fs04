import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    // Get bundles from database
    const bundles = await locals.prisma.bundle.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        os: true,
        version: true,
        reboot: true,
        createdAt: true,
        updatedAt: true,
        apps: {
          select: {
            id: true,
            order: true,
            autoOpen: true,
            resource: {
              select: {
                id: true,
                name: true,
                type: true,
                size: true
              }
            }
          },
          orderBy: { order: 'asc' }
        },
        _count: {
          select: {
            apps: true,
            devices: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    const total = await locals.prisma.bundle.count({ where });

    return json({
      success: true,
      bundles,
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
