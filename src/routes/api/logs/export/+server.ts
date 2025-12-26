
import { error, redirect } from '@sveltejs/kit';
import { logService } from '$lib/server/clickhouse/logService';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        const session = await locals.auth.validate();
        if (!session) {
            throw error(401, 'Unauthorized');
        }

        const search = url.searchParams.get('search') || undefined;
        const level = url.searchParams.get('level') || undefined;
        const deviceId = url.searchParams.get('deviceId') || undefined;
        const startTimeStr = url.searchParams.get('startTime');
        const endTimeStr = url.searchParams.get('endTime');
        const sortBy = url.searchParams.get('sortBy') || 'timestamp';
        const sortOrder = (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
        const format = (url.searchParams.get('format') as 'csv' | 'json') || 'csv';
        const accountId = url.searchParams.get('accountId') || undefined;

        const startTime = startTimeStr ? new Date(startTimeStr) : undefined;
        const endTime = endTimeStr ? new Date(endTimeStr) : undefined;

        const downloadUrl = await logService.exportLogs({
            search,
            level,
            deviceId,
            accountId,
            startTime,
            endTime,
            sortBy,
            sortOrder,
            format,
            // Pagination ignored for export usually, or we export ALL matching
            limit: 1000000 // reasonable hard limit for sync export
        });

        throw redirect(302, downloadUrl);

    } catch (err) {
        if ((err as any).status === 302) throw err; // Re-throw redirect

        logger.error(`[API] Failed to export logs: ${err}`);
        // Handle specific "Sync limit exceeded" error from service
        if (err instanceof Error && err.message.includes('Date range too large')) {
            throw error(400, err.message);
        }
        throw error(500, 'Failed to export logs');
    }
};
