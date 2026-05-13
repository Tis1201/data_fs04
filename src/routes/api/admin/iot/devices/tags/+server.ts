import { json } from '@sveltejs/kit';
import { errorHandler } from '$lib/server/errors/errorHandler';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!auth.currentAccount?.id) {
      return json({ error: 'No current account selected' }, { status: 400 });
    }

    // Get all device tags for the current account
    const tags = await locals.prisma.deviceTag.findMany({
      where: {
        accountId: auth.currentAccount.id
      },
      select: {
        id: true,
        name: true,
        description: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Add a default color for each tag since the model doesn't have a color field
    const tagsWithColor = tags.map(tag => ({
      ...tag,
      color: '#6b7280' // Default gray color
    }));

    return json({
      success: true,
      tags: tagsWithColor
    });

  } catch (error) {
    return errorHandler(error);
  }
};
