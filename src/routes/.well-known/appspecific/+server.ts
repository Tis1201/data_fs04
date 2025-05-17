import type { RequestHandler } from '@sveltejs/kit';

// Handle all HTTP methods for this route
export const GET: RequestHandler = async () => {
  return new Response('', {
    status: 204,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
};

// Also handle POST requests if needed
export const POST: RequestHandler = async () => {
  return new Response('', {
    status: 204,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
};
