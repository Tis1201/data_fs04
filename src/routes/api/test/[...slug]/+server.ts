// Create an endpoint that will return a random text 
// this is to test the Nginx testing, still it will be random, if cache is working, it will return the same text?
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET handler for testing Nginx caching
 * 
 * If Nginx caching is working correctly, repeated requests to this endpoint
 * should return the same text within the cache validity period.
 */
export const GET: RequestHandler = async ({ params }) => {
  // Generate random text
  const randomText = Math.random().toString(36).substring(2, 15);
  
  // Add timestamp to see when the response was generated
  const timestamp = new Date().toISOString();
  
  // Get the slug parameter to allow testing different cache keys
  const slug = params.slug || 'default';
  
  // Add a 5-second delay to simulate a slow endpoint
  // This will make the caching benefits more obvious
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Return JSON response with cache control headers
  return json(
    {
      randomText,
      timestamp,
      slug,
      message: 'If you see the same randomText on refresh, Nginx caching is working!'
    },
    {
      headers: {
        // Set Cache-Control header to make the response cacheable
        // This is just for the browser - Nginx has its own cache configuration
        'Cache-Control': 'public, max-age=60',
        // Add custom header to help with debugging
        'X-Generated-At': timestamp
      }
    }
  );
};