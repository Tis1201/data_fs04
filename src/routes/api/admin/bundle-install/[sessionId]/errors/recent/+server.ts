import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/database';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ params, locals, url }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return json({ error: 'Session ID is required' }, { status: 400 });
    }

    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const errors = await prisma.bundleInstallError.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });

    return json({
      success: true,
      errors
    });

  } catch (error) {
    return errorHandler(error);
  }
};
