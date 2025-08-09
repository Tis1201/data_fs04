import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recoveryService } from '$lib/server/bundle-install/recoveryService';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const POST: RequestHandler = async ({ params, request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return json({ error: 'Session ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const options = body.options || {};

    const result = await recoveryService.recoverSession(sessionId, options);

    return json({
      success: result.success,
      message: result.message,
      result
    });

  } catch (error) {
    return errorHandler(error);
  }
};
