import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ url, locals, params }) => {
  try {
    // Get authenticated user
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '5');
    const sort = url.searchParams.get('sort') || 'name';
    const order = (url.searchParams.get('order') || 'asc') as 'asc' | 'desc';
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';

    // Bundle ID from route params
    const { id: bundleId } = params as { id: string };

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status;
    }

    // Exclude devices already in this bundle
    let excludedDeviceIds: string[] = [];
    if (bundleId) {
      const existing = await locals.prisma.bundleDevice.findMany({
        where: { bundleId },
        select: { deviceId: true }
      });
      excludedDeviceIds = existing.map((e) => e.deviceId);
      if (excludedDeviceIds.length > 0) {
        where.id = { notIn: excludedDeviceIds };
      }
    }

    logger.info(`[DeviceSelector] bundleId=${bundleId} page=${page} perPage=${perPage} sort=${sort} order=${order} search='${search}' status='${status}' excludeCount=${excludedDeviceIds.length}`);

    // Get total count (after exclusions)
    const total = await locals.prisma.device.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / perPage);
    const skip = (page - 1) * perPage;

    // Get devices
    const devices = await locals.prisma.device.findMany({
      where,
      select: {
        id: true,
        name: true,
        model: true,
        status: true,
        description: true,
        createdAt: true,
        lastUsedAt: true,
        connected: true
      },
      orderBy: {
        [sort]: order
      },
      skip,
      take: perPage
    });

    logger.info(`[DeviceSelector] returning ${devices.length} devices of total ${total}`);

    return json({
      success: true,
      devices,
      meta: {
        current_page: page,
        per_page: perPage,
        total,
        last_page: totalPages
      }
    });

  } catch (err) {
    return errorHandler(err);
  }
};
