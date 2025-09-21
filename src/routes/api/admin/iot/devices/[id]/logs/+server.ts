import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { sseStore } from '$lib/stores/sse-store';
import { errorHandler } from '$lib/server/errors/errorHandler';

export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params } = event;
        try {
            const deviceId = params.id;
            
            if (!deviceId) {
                return json({ error: 'Device ID is required' }, { status: 400 });
            }

            // Request logs from the device via SSE
            const responsePayload = await sseStore.sendRequest(
                {
                    type: 'device',
                    scope: `subscription:device:${deviceId}`,
                    payload: {
                        action: 'getLogs',
                        deviceId: deviceId,
                        format: 'zip' // Request logs as zip file
                    }
                },
                /* timeoutMs = */ 30000, // Allow more time for file generation
                /* requestIdPrefix = */ 'logs'
            );

            if (!responsePayload?.logsData) {
                return json({ error: 'No logs data received from device' }, { status: 404 });
            }

            // The device should return logsData as base64 encoded zip file
            const zipData = responsePayload.logsData;
            const zipBuffer = Buffer.from(zipData, 'base64');

            // Create a readable stream from the buffer
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(zipBuffer);
                    controller.close();
                }
            });

            // Return the zip file as a stream
            return new Response(stream, {
                status: 200,
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="device-${deviceId}-logs-${new Date().toISOString().split('T')[0]}.zip"`,
                    'Content-Length': zipBuffer.length.toString(),
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

        } catch (error: any) {
            logger.error('Error fetching device logs:', error);
            return errorHandler(error);
        }
    },
    [SystemRole.ADMIN]
);
