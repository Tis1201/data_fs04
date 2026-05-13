/**
 * GET /api/sensor-data/[dataType]/export
 *
 * Streams CSV (CSVWithNames) from ClickHouse through to the HTTP response without loading all rows in Node.
 */

import { json, type RequestHandler } from '@sveltejs/kit';
import { restrict } from '$lib/server/security/guards';
import { isClickHouseInfrastructureError } from '$lib/server/clickhouse/client';
import { sensorDataService, SensorDataExportValidationError, type SensorDataType } from '$lib/server/clickhouse/sensor-data';
import type { SensorDataQueryParams } from '$lib/server/clickhouse/sensor-data/types';

const VALID_DATA_TYPES: SensorDataType[] = ['radar_session', 'radar_path'];

export const GET: RequestHandler = restrict(async ({ url, params, auth }) => {
    const dataType = params.dataType as SensorDataType;
    if (!VALID_DATA_TYPES.includes(dataType)) {
        return json({ error: `Invalid data type: ${dataType}. Valid types: ${VALID_DATA_TYPES.join(', ')}` }, { status: 400 });
    }

    const user = auth.user;
    const isAdmin = user.systemRole === 'ADMIN';
    const accountIdParam = url.searchParams.get('accountId');

    let accountId: string | undefined;
    if (isAdmin && accountIdParam) {
        accountId = accountIdParam;
    } else if (auth.currentAccount?.account?.id) {
        accountId = auth.currentAccount.account.id;
    } else if (auth.currentAccount?.accountId) {
        accountId = auth.currentAccount.accountId;
    } else if (user.primaryAccountId) {
        accountId = user.primaryAccountId;
    }

    if (!accountId) {
        return json({ error: 'Account ID required. Please select an account.' }, { status: 400 });
    }

    const queryParams: SensorDataQueryParams = {
        dataType,
        accountId,
        deviceId: url.searchParams.get('deviceId') || undefined,
        sensorId: url.searchParams.get('sensorId') || undefined,
        macAddress: url.searchParams.get('macAddress') || url.searchParams.get('mac') || undefined,
        targetId: url.searchParams.get('targetId') || undefined,
        search: url.searchParams.get('search') || undefined,
        searchFields:
            url.searchParams
                .get('searchFields')
                ?.split(',')
                .map((s) => s.trim())
                .filter(Boolean) || undefined,
        startTime: url.searchParams.get('startTime') || undefined,
        endTime: url.searchParams.get('endTime') || undefined,
        sortBy: url.searchParams.get('sort_by') || url.searchParams.get('sort') || undefined,
        sortOrder: (url.searchParams.get('sort_order') || url.searchParams.get('order')) as 'asc' | 'desc' | undefined
    };

    try {
        const stream = await sensorDataService.streamExportCsvWeb(queryParams);
        const day = new Date().toISOString().slice(0, 10);
        const filename = `${dataType}_export_${day}.csv`;
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (err) {
        if (err instanceof SensorDataExportValidationError) {
            return json({ error: err.message }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error('[API sensor-data export]', message, err instanceof Error ? err.stack : '');

        const isRequiredRange = message.includes('startTime and endTime are required');
        if (isRequiredRange) {
            return json({ error: message }, { status: 400 });
        }

        const infra = isClickHouseInfrastructureError(message);
        const status = infra ? 503 : 500;
        const userError = infra ? 'Sensor data store temporarily unavailable' : 'Failed to export sensor data';
        return json(
            {
                error: userError,
                detail: process.env.NODE_ENV === 'development' || infra ? message : undefined
            },
            { status }
        );
    }
}, ['ADMIN', 'USER']);
