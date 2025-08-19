import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = async ({ url, locals }) => {
  try {
    const auth = await locals.auth.validate();
    if (!auth?.user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accountId = url.searchParams.get('accountId');

    const devices = await locals.prisma.device.findMany({
        where: { 
            accountId,
            status: 'ACTIVE',
            factoryTokens: {
                some: { isUsed: false }   // ensures device has at least one unused token
            }
        },
        select: { 
            id: true, 
            name: true,
            hardwareId: true,
            deviceType: true,
            factoryTokens: {
                where: { isUsed: false }, 
                select: { id: true, name: true, hardwareModel: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    const deviceOptions = devices
        .map((d: any) => ({
            value: d.id,
            label: `${d.name}${d.hardwareId ? ` (${d.hardwareId})` : ''}${d.deviceType ? ` - ${d.deviceType}` : ''} [${d.factoryTokens.length} token(s)]`
        }));

    return json({
      success: true,
      deviceOptions,
    });
  } catch (error) {
    return errorHandler(error);
  }
};
