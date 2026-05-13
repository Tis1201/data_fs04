import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma';
import { logger } from '$lib/server/logger';
import { getStorageConfig, convertGCloudUrlToSignedDownloadUrl } from '$lib/server/storage';

/**
 * GET /api/devices/[id]/screenshot/[logId]
 * Returns { url, downloadAuth, fileName } for browser-direct CDN fetch (Browser → CDN only, no server proxy).
 * format=json required for R2; non-json returns 400.
 */
export const GET: RequestHandler = restrict(
    async (event: import('@sveltejs/kit').RequestEvent) => {
        const { params, locals, url } = event;
        const wantJson =
            url.searchParams.get('format') === 'json' ||
            (event.request.headers.get('accept') ?? '').includes('application/json');
        const deviceId = params.id;
        const logId = params.logId;
        const user = (locals as any).user;

        logger.debug('[Screenshot] Handler entered', { deviceId, logId, hasUser: !!user, userId: user?.id });

        if (!deviceId || !logId) {
            return new Response(JSON.stringify({ error: 'Missing deviceId or logId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const device = await prisma.device.findUnique({
            where: { id: deviceId },
            select: {
                id: true,
                createdBy: true,
                accountId: true,
                account: {
                    select: {
                        members: { select: { userId: true } }
                    }
                }
            }
        });

        if (!device) {
            logger.warn('[Screenshot] Device not found', { deviceId });
            return new Response(JSON.stringify({ error: 'Device not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (user.systemRole !== SystemRole.ADMIN) {
            const isOwner = device.createdBy === user.id;
            const isAccountMember =
                device.accountId &&
                device.account?.members?.some((m: { userId: string }) => m.userId === user.id);
            if (!isOwner && !isAccountMember) {
                return new Response(JSON.stringify({ error: 'Forbidden' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        const actionLog = await prisma.deviceActionLog.findFirst({
            where: { id: logId, deviceId },
            select: { metadata: true }
        });

        if (!actionLog) {
            logger.warn('[Screenshot] Action log not found', { logId, deviceId });
            return new Response(JSON.stringify({ error: 'Action log not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const metadata = actionLog.metadata as Record<string, unknown> | null;
        const objectPath = metadata?.objectPath as string | undefined;

        const storageConfig = getStorageConfig();
        if (storageConfig.mode === 'R2') {
            if (!objectPath) {
                return new Response(JSON.stringify({ error: 'Screenshot object path not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            const result = await convertGCloudUrlToSignedDownloadUrl(objectPath, 3600, 'screenshot.jpg');
            if (!result?.downloadAuth) {
                return new Response(JSON.stringify({ error: 'HMAC required for R2. Set CLOUDFLARE_R2_CDN_URL and CLOUDFLARE_R2_ACCESS_HMAC.' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return json({
                url: result.downloadUrl,
                downloadAuth: result.downloadAuth,
                fileName: 'screenshot.jpg'
            });
        }

        if (!wantJson) {
            return new Response(JSON.stringify({ error: 'Use format=json for browser-direct download' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (storageConfig.mode === 'LOCAL' && objectPath) {
            const result = await convertGCloudUrlToSignedDownloadUrl(objectPath, 3600, 'screenshot.jpg');
            if (result) {
                return json({ url: result.downloadUrl, fileName: 'screenshot.jpg' });
            }
        }
        return new Response(JSON.stringify({ error: 'Screenshot not available' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
