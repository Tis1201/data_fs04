// Create an endpoint that will return a random text 
// this is to test the Nginx testing, still it will be random, if cache is working, it will return the same text?
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listRooms } from '$lib/server/room/RoomManager';

/**
 * GET handler for testing Nginx caching
 * 
 * If Nginx caching is working correctly, repeated requests to this endpoint
 * should return the same text within the cache validity period.
 */
export const GET: RequestHandler = async ({ params }) => {
  if (process.env.NODE_ENV !== 'development') {
    return json({ error: 'Not found' }, { status: 404 });
  }
  const slug = params.slug || 'default';

  // If slug is 'latest-room', return latest room info
  if (slug === 'latest-room') {
    const rooms = listRooms();
    if (!rooms.length) {
      return json({ error: 'No rooms found' }, { status: 404 });
    }
    // Sort by lastActivity or createdAt, descending
    rooms.sort((a, b) => {
      const aTime = a.lastActivity?.getTime?.() || a.createdAt.getTime();
      const bTime = b.lastActivity?.getTime?.() || b.createdAt.getTime();
      return bTime - aTime;
    });
    // Return the most recent room's info (getStatus or toJSON or object)
    const room = rooms[0];
    
    return json(room.getStatus());
   
  }

  // Existing random text/caching test logic
  const randomText = Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();

  await new Promise(resolve => setTimeout(resolve, 5000));

  return json(
    {
      randomText,
      timestamp,
      slug,
      message: 'If you see the same randomText on refresh, Nginx caching is working!'
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60',
        'X-Generated-At': timestamp
      }
    }
  );
};