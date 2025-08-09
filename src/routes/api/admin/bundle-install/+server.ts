import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { bundleInstallService } from '$lib/server/bundle-install/bundleInstallService';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, deviceIds, bundleIds, batchSize, metadata } = body;

    if (!name || !deviceIds || !bundleIds) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return json({ error: 'At least one device must be selected' }, { status: 400 });
    }

    if (!Array.isArray(bundleIds) || bundleIds.length === 0) {
      return json({ error: 'At least one bundle must be selected' }, { status: 400 });
    }

    const session = await bundleInstallService.createSession({
      name,
      description,
      deviceIds,
      bundleIds,
      batchSize,
      metadata
    }, auth.user.userId, locals.prisma);

    return json({
      success: true,
      sessionId: session.id,
      message: `Created bundle install session with ${session.totalDevices} devices and ${session.totalBundles} bundles`
    });

  } catch (error) {
    return errorHandler(error);
  }
};

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const filters = {
      status,
      limit,
      offset
    };

    const result = await bundleInstallService.getSessionList(filters, locals.prisma);

    return json({
      success: true,
      sessions: result.sessions,
      total: result.total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < result.total
      }
    });

  } catch (error) {
    return errorHandler(error);
  }
};
