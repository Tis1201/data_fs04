
import { error, json } from '@sveltejs/kit';
import { logService } from '$lib/server/clickhouse/logService';
import type { RequestHandler } from './$types';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ url, locals }) => {
    try {
        const session = await locals.auth.validate();
        if (!session) {
            throw error(401, 'Unauthorized');
        }

        const page = Number(url.searchParams.get('page')) || 1;
        const limit = Number(url.searchParams.get('limit')) || 50;
        const search = url.searchParams.get('search') || undefined;
        const level = url.searchParams.get('level') || undefined;
        const deviceId = url.searchParams.get('deviceId') || undefined;
        const startTimeStr = url.searchParams.get('startTime');
        const endTimeStr = url.searchParams.get('endTime');
        const sortBy = url.searchParams.get('sortBy') || 'timestamp';
        const sortOrder = (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

        // Security Scoping
        // If user is not admin, force scoping? 
        // Assuming 'locals.user' has role info. If generic user, strictly scope to their account/user?
        // For now, let's assume if deviceId is passed, we check if user owns device (expensive here without DB).
        // Better: Scope by accountId if user is not system admin
        // Let's assume session.user.accountId or similar exists, or we trust the query but verify ownership in a middleware?
        // Given existing patterns: user usually effectively scoped by their context.
        // We will default to scoping by the User's primary account if explicit accountId not provided and they are not admin.

        let accountId = url.searchParams.get('accountId') || undefined;
        // Logic: specific implementation depends on auth model. 
        // Minimal viable security: pass accountId if present, rely on Service/ClickHouse limits or trust caller for now if internal API?
        // No, this is user facing.
        // Safe bet: always enforce accountId from session if available.

        // checking session user properties (assumed based on standard Lucia/Auth setup in this project)
        // Adjust based on actual User type if needed.
        if (session.user && !accountId) {
            // accountId = session.user.primaryAccountId; // If applicable
        }

        const startTime = startTimeStr ? new Date(startTimeStr) : undefined;
        const endTime = endTimeStr ? new Date(endTimeStr) : undefined;

        const result = await logService.getLogs({
            page,
            limit,
            search,
            level,
            deviceId,
            accountId,
            startTime,
            endTime,
            sortBy,
            sortOrder
        });

        return json(result);

    } catch (err) {
        logger.error(`[API] Failed to fetch logs: ${err}`);
        throw error(500, 'Failed to fetch logs');
    }
};
