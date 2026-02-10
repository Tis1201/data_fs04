/**
 * API Route: GET /api/sensor-data/[dataType]
 *
 * Generic endpoint for querying sensor data MVs.
 * Security: Account ID is enforced from session for non-admin users.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { sensorDataService, type SensorDataType } from '$lib/server/clickhouse/sensor-data';

const VALID_DATA_TYPES: SensorDataType[] = ['radar_session', 'radar_path'];

export const GET: RequestHandler = restrict(async ({ url, params, auth }) => {
    // Validate data type
    const dataType = params.dataType as SensorDataType;
    if (!VALID_DATA_TYPES.includes(dataType)) {
        return json({ error: `Invalid data type: ${dataType}. Valid types: ${VALID_DATA_TYPES.join(', ')}` }, { status: 400 });
    }

    // Determine account ID (admin can override, users cannot)
    const user = auth.user;
    const isAdmin = user.systemRole === 'ADMIN';
    const accountIdParam = url.searchParams.get('accountId');

    let accountId: string | undefined;
    if (isAdmin && accountIdParam) {
        // Admin can query specific account
        accountId = accountIdParam;
    } else if (auth.currentAccount?.account?.id) {
        // Use current account from session
        accountId = auth.currentAccount.account.id;
    } else if (auth.currentAccount?.accountId) {
        // Alternative format
        accountId = auth.currentAccount.accountId;
    } else if (user.primaryAccountId) {
        // Fallback to primary account
        accountId = user.primaryAccountId;
    }

    if (!accountId) {
        return json({ error: 'Account ID required. Please select an account.' }, { status: 400 });
    }

    // Parse query parameters
    const queryParams = {
        dataType,
        accountId,
        deviceId: url.searchParams.get('deviceId') || undefined,
        sensorId: url.searchParams.get('sensorId') || undefined,
        targetId: url.searchParams.get('targetId') || undefined,
        search: url.searchParams.get('search') || undefined,
        startTime: url.searchParams.get('startTime') || undefined,
        endTime: url.searchParams.get('endTime') || undefined,
        page: parseInt(url.searchParams.get('page') || '1', 10),
        perPage: parseInt(url.searchParams.get('per_page') || '25', 10),
        // Support both legacy (sort_by, sort_order) and new (sort, order) parameter names
        sortBy: url.searchParams.get('sort_by') || url.searchParams.get('sort') || undefined,
        sortOrder: (url.searchParams.get('sort_order') || url.searchParams.get('order')) as 'asc' | 'desc' || undefined,
    };

    try {
        const result = await sensorDataService.query(queryParams);
        return json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
        console.error('[API sensor-data]', message, code ? `(code: ${code})` : '', err instanceof Error ? err.stack : '');
        return json(
            { error: 'Failed to query sensor data', detail: process.env.NODE_ENV === 'development' ? message : undefined },
            { status: 500 }
        );
    }
}, ['ADMIN', 'USER']);
