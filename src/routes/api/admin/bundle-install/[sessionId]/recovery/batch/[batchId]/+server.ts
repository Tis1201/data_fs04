import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recoveryService } from '$lib/server/bundle-install/recoveryService';

import { errorHandler } from '$lib/server/errors/errorHandler';

export const POST: RequestHandler = async ({ params, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, batchId } = params;
    if (!sessionId || !batchId) {
      return json({ error: 'Session ID and Batch ID are required' }, { status: 400 });
    }

    const recovered = await recoveryService.recoverBatch(batchId, {
      autoRetry: true,
      maxRetries: 3,
      retryDelay: 5000,
      notifyOnFailure: true,
      escalateOnPermanentFailure: true
    });

    return json({
      success: recovered,
      message: recovered ? 'Batch recovery initiated' : 'Batch recovery failed'
    });

  } catch (error) {
    return errorHandler(error);
  }
};
