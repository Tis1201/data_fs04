import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { restrict_device } from '$lib/server/security/guards';
import { logger } from '$lib/server/logger';
import { ActionLogger } from '$lib/server/action-logger';
import prisma from '$lib/server/prisma';

export const POST: RequestHandler = async ({ request, locals }) => {
    const result = await restrict_device({ locals, request });
    
    if ('error' in result) {
        return json({
            success: false,
            error: result.error,
            message: result.error
        }, { status: result.response.status });
    }
    
    const { device } = result;
    
    if (device.status !== 'ACTIVE') {
        return json({
            success: false,
            error: 'Device not active',
            message: 'Device not active'
        }, { status: 404 });
    }

    try {
        const body = await request.json();
        const { logId, action, status, message } = body;

        if (!logId || !action || !status) {
            return json({
                success: false,
                error: 'Missing required fields: logId, action, status',
                message: 'Missing required fields'
            }, { status: 400 });
        }

        // Find the action log
        const actionLog = await prisma.deviceActionLog.findFirst({
            where: {
                id: logId,
                deviceId: device.id
            }
        });

        if (!actionLog) {
            return json({
                success: false,
                error: 'Action log not found',
                message: 'Action log not found'
            }, { status: 404 });
        }

        // Update the action log with the status and get the updated log with duration
        const finalStatus = status === 'complete' ? 'success' : 'failed';
        const updatedLog = await ActionLogger.finalize(actionLog.id, finalStatus, message || `${action} ${status}`);

        // Publish SSE update for real-time UI updates
        const { MessageFactory } = await import('$lib/server/messaging/interfaces/message');
        const { publisher } = await import('$lib/server/messaging/core/publisher');
        const { SystemUser } = await import('$lib/server/messaging/interfaces/message');

        const sseMessage = MessageFactory.createSystemMessage(
            'device:statusUpdate',
            `subscription:device:${device.id}`,
            {
                logId,
                action,
                status,
                message: message || `${action} ${status}`,
                durationMs: updatedLog.durationMs, // Include server-calculated duration
                timestamp: new Date().toISOString()
            },
            SystemUser,
            { echoToSender: false }
        );

        await publisher.publish(sseMessage);

        logger.info(`[DeviceStatusAPI] Device ${device.id} reported ${action} ${status} for log ${logId}`);

        return json({
            success: true,
            data: {
                logId,
                action,
                status,
                message: message || `${action} ${status}`,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        logger.error(`[DeviceStatusAPI] Error handling device status update: ${String(error)}`);
        return json({
            success: false,
            error: 'Failed to process status update',
            message: 'Failed to process status update'
        }, { status: 500 });
    }
};