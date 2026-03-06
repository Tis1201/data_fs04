/**
 * POST /api/user/iot/devices/[id]/rdp-complete
 *
 * Marks an RDP action log as success. Called by the RDP page when it receives
 * rdp:started over the WebRTC data channel (the device sends this only over
 * WebRTC, not MQTT, so the server never receives it).
 *
 * Body: { logId: string }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { errorHandler } from '$lib/server/errors/errorHandler';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import { broadcastDeviceActionUpdate } from '$lib/server/mqtt/handlers/notifications/device_action_broadcaster';

export const POST: RequestHandler = async ({ params, request, locals }) => {
    try {
        const { id: deviceId } = params;
        const body = await request.json().catch(() => ({}));
        const logId = body?.logId as string | undefined;

        if (!logId) {
            return json({ success: false, error: 'logId is required' }, { status: 400 });
        }

        const auth = await locals.auth.validate();
        if (!auth?.user) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userId = auth.user.id;
        const prisma = locals.prisma;

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
            return json({ success: false, error: 'Device not found' }, { status: 404 });
        }

        const isOwner = device.createdBy === userId;
        const isAccountMember = Boolean(
            device.accountId &&
                device.account?.members?.some((m) => m.userId === userId)
        );

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { systemRole: true }
        });
        const isAdmin = user?.systemRole === 'ADMIN' || user?.systemRole === 'SUPER_ADMIN';

        if (!isOwner && !isAccountMember && !isAdmin) {
            return json({ success: false, error: 'Access denied to this device' }, { status: 403 });
        }

        const log = await prisma.deviceActionLog.findUnique({
            where: { id: logId },
            select: { id: true, deviceId: true, actionType: true, status: true }
        });

        if (!log) {
            return json({ success: false, error: 'Action log not found' }, { status: 404 });
        }

        if (log.deviceId !== deviceId) {
            return json({ success: false, error: 'Log does not belong to this device' }, { status: 400 });
        }

        if (log.actionType !== 'remote_desktop') {
            return json({ success: false, error: 'Log is not an RDP action' }, { status: 400 });
        }

        if (log.status !== 'initiated' && log.status !== 'in_progress') {
            return json({ success: true, message: 'Log already finalized' });
        }

        await ActionLogger.finalize(logId, 'success', 'RDP session started successfully');

        if (device.accountId) {
            await broadcastDeviceActionUpdate({
                prisma,
                deviceId,
                logId,
                action: 'remote_desktop',
                status: 'success',
                message: 'RDP session started successfully',
                accountId: device.accountId
            });
        }

        logger.info('[RDP Complete API] Marked RDP log as success', {
            logId,
            deviceId,
            userId
        });

        return json({ success: true });
    } catch (err) {
        return errorHandler(err);
    }
};
