import { unifiedEndpoint } from '$lib/server/api/unifiedEndpoint';
import { successResponse } from '$lib/types/api';

/**
 * GET /api/v2/bundles/[id]/device_tags
 * Get available device tags for filtering
 * 
 * This is a simple UI helper endpoint that returns all device tags
 * for use in device selection filters
 */
export const GET = unifiedEndpoint(
  async ({ context }) => {
    const { prisma } = context;

    const availableTags = await prisma.deviceTag.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    return successResponse({ availableTags });
  },
  { permission: 'bundle.view' }
);

