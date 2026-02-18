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

    // Bundle ID from route params
    const { id: deviceId } = params as { id: string };

    // Scope to current account (switch-account aware)
    const currentAccountId = (locals as any).currentAccount?.account?.id;
    const where: any = {};
    if (currentAccountId) {
      where.accountId = currentAccountId;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Exclude device tags already in this device
    let excludedDeviceTagIds: string[] = [];
    if (deviceId) {
      const device = await locals.prisma.device.findUnique({
        where: { id: deviceId },
        select: { tags: { select: { id: true } } }
      });

      
      excludedDeviceTagIds = device?.tags.map(tag => tag.id) ?? [];
      console.log({excludedDeviceTagIds})
      if (excludedDeviceTagIds.length > 0) {
        where.id = { notIn: excludedDeviceTagIds };
      }
    }
    
    logger.info(`[DeviceTagSelector] deviceId=${deviceId} page=${page} perPage=${perPage} sort=${sort} order=${order} search='${search}' excludeCount=${excludedDeviceTagIds.length}`);
    console.log({where})

    // Get total count (after exclusions)
    const total = await locals.prisma.deviceTag.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / perPage);
    const skip = (page - 1) * perPage;

    // Get device tags
    const deviceTags = await locals.prisma.deviceTag.findMany({
      where,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        [sort]: order
      },
      skip,
      take: perPage
    });

    logger.info(`[DeviceTagSelector] returning ${deviceTags.length} device tags of total ${total}`);

    return json({
      success: true,
      deviceTags,
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
