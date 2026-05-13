import type { RequestHandler } from './$types';
import { json, redirect } from '@sveltejs/kit';
import { restrict, type AuthenticatedEvent } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';
import { logger } from '$lib/server/logger';
import { errorHandler } from '$lib/server/errors/errorHandler';

/**
 * @deprecated This endpoint is deprecated. Use /api/devices/[id]/actions with action='getLogs' instead.
 * 
 * This endpoint redirects to the unified action API which uses MQTT queue.
 * The new flow:
 * 1. Device uploads logs to storage via presigned URL
 * 2. Action log tracks the progress
 * 3. Download URL is available in the action log response
 */
export const GET: RequestHandler = restrict(
    async (event: AuthenticatedEvent) => {
        const { params } = event;
        try {
            const deviceId = params.id;
            
            if (!deviceId) {
                return json({ error: 'Device ID is required' }, { status: 400 });
            }

            // Redirect to unified action API
            // The unified action API uses MQTT queue and returns action log with download URL
            logger.warn(`[DeviceLogs] Legacy endpoint called - redirecting to unified action API for device ${deviceId}`);
            
            // Redirect to the unified action API endpoint
            // The client should use POST /api/devices/[id]/actions with { action: 'getLogs', format: 'zip' }
            return json({
                error: 'This endpoint is deprecated',
                message: 'Please use POST /api/devices/[id]/actions with action="getLogs"',
                redirect: `/api/devices/${deviceId}/actions`
            }, { status: 410 }); // 410 Gone - indicates resource is no longer available

        } catch (error: any) {
            logger.error('Error in deprecated device logs endpoint:', error);
            return errorHandler(error);
        }
    },
    [SystemRole.ADMIN]
);
