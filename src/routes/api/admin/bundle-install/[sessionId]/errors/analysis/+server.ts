import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bundleInstallErrorHandler } from '$lib/server/bundle-install/errorHandler';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return json({ error: 'Session ID is required' }, { status: 400 });
    }

    const errorSummary = await bundleInstallErrorHandler.getErrorSummary(sessionId);

    return json({
      success: true,
      analysis: errorSummary
    });

  } catch (error) {
    return errorHandler(error);
  }
};
