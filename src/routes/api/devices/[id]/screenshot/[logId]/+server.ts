import { redirect } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import prisma from '$lib/server/prisma';
import { generateDownloadUrl } from '$lib/server/storage';
import { logger } from '$lib/server/logger';

/**
 * GET /api/devices/[id]/screenshot/[logId]
 * - Default: 302 redirect to signed download URL (for direct links).
 * - Accept: application/json or ?format=json: returns { url } so the client can set img src to the signed URL (avoids redirect/cookie issues in img).
 */
export const GET: RequestHandler = restrict(
    async (event) => {
        const { params, locals, url } = event;
        const wantJson =
            url.searchParams.get('format') === 'json' ||
            (event.request.headers.get('accept') ?? '').includes('application/json');
        const deviceId = params.id;
        const logId = params.logId;
        const user = (locals as any).auth?.user;

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }

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
            where: { id: logId, deviceId }
        });

        if (!actionLog) {
            return new Response(JSON.stringify({ error: 'Action log not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const metadata = actionLog.metadata as Record<string, unknown> | null;
        const objectPath = metadata?.objectPath as string | undefined;

        if (!objectPath || typeof objectPath !== 'string') {
            return new Response(JSON.stringify({ error: 'Screenshot not available (no objectPath)' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        try {
            const result = await generateDownloadUrl(objectPath, 3600, 'screenshot.jpg');
            if (wantJson) {
                return json({ url: result.url });
            }
            redirect(302, result.url);
        } catch (err) {
            logger.error(`[Screenshot] Failed to generate download URL: ${err}`);
            return new Response(
                JSON.stringify({ error: 'Failed to generate screenshot URL' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }
    },
    [SystemRole.ADMIN, SystemRole.USER]
);
