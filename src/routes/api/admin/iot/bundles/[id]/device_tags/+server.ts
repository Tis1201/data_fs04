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

    const availableTags = await locals.prisma.deviceTag.findMany({
        select: {
            id: true,
            name: true
        }
    })

    return json({
      success: true,
      availableTags
    });

  } catch (err) {
    return errorHandler(err);
  }
};
