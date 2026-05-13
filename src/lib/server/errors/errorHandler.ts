import { handleApiError } from './errorHandlers';
import { json } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

export async function errorHandler(error: unknown) {
  try {
    const result = await handleApiError({
      error,
      defaultMessage: 'An unexpected error occurred',
      status: 500
    });

    return json(result, { status: result.status || 500 });
  } catch (handlerError) {
    logger.error('Error in error handler:', handlerError);
    return json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      }, 
      { status: 500 }
    );
  }
}
