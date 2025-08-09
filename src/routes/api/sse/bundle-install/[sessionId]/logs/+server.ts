import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sseService } from '$lib/server/sse/sseService';
import { authService } from '$lib/server/auth/authService';

export const GET: RequestHandler = async ({ params, locals }) => {
  try {
    const user = await authService.getUser(locals);
    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    if (!sessionId) {
      return json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Set up SSE connection for logs
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(`data: ${JSON.stringify({
          type: 'connection',
          message: 'Connected to session logs'
        })}\n\n`);

        // Subscribe to log updates
        const unsubscribe = sseService.subscribeToSessionLogs(sessionId, (data) => {
          controller.enqueue(`data: ${JSON.stringify({
            type: 'session:log',
            payload: data
          })}\n\n`);
        });

        // Clean up on close
        return () => {
          unsubscribe();
        };
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });

  } catch (error) {
    console.error('SSE logs error:', error);
    return json({ error: 'SSE connection failed' }, { status: 500 });
  }
};
