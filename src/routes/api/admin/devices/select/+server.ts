import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import prisma from '$lib/server/prisma';

export const GET: RequestHandler = restrict(async ({ url, locals, auth }: any) => {
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const perPage = Math.min(50, Math.max(1, Number(url.searchParams.get('per_page') || '10')));
  const sort = (url.searchParams.get('sort') || 'name') as 'name' | 'status' | 'lastUsedAt';
  const order = (url.searchParams.get('order') || 'asc') as 'asc' | 'desc';
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status');
  const tag = url.searchParams.get('tag');
  const excludeIdsCsv = url.searchParams.get('excludeDeviceIds');
  const includeIdsCsv = url.searchParams.get('includeDeviceIds');
  const excludeIds = excludeIdsCsv ? excludeIdsCsv.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const includeIds = includeIdsCsv ? includeIdsCsv.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { id: { contains: search, mode: 'insensitive' } }
    ];
  }
  if (status) where.status = status;
  if (includeIds.length) where.id = { in: includeIds };
  else if (excludeIds.length) where.id = { notIn: excludeIds };

  // Non-admin: restrict by account memberships
  if ((auth?.user?.systemRole || '').toUpperCase() !== 'ADMIN') {
    const memberships = await locals.prisma.accountMembership.findMany({
      where: { userId: auth?.user?.id },
      select: { accountId: true }
    });
    const accountIds = memberships.map((m: any) => m.accountId);
    where.accountId = accountIds.length > 0 ? { in: accountIds } : '__NO_ACCOUNT__';
  }

  const skip = includeIds.length ? 0 : (page - 1) * perPage;
  const total = await locals.prisma.device.count({ where });
  const devices = await locals.prisma.device.findMany({
    where,
    orderBy: [{ [sort]: order }, { id: 'asc' }],
    skip,
    take: includeIds.length ? includeIds.length : perPage,
    select: {
      id: true,
      name: true,
      status: true,
      model: true,
      description: true,
      connected: true,
      lastUsedAt: true
    }
  });

  return json({
    devices,
    meta: {
      current_page: page,
      per_page: perPage,
      total,
      last_page: Math.max(1, Math.ceil(total / perPage))
    }
  });
}, ['ADMIN', 'USER']);


