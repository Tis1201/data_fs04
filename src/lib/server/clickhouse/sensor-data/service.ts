/**
 * Sensor Data Service
 *
 * Generic service for querying ClickHouse MVs for sensor data.
 * Enforces account_id scoping at the service layer.
 */

import { getClickHouseClient } from '../client';
import {
    MV_REGISTRY,
    type MVConfig,
    type SensorDataQueryParams,
    type SensorDataResponse,
    type SensorDataRow,
} from './types';
import { RADAR_ANALYTICS_EXPORT_MAX_RANGE_MS } from '$lib/utils/radarExportLimits';

/** Thrown for invalid export requests (returns HTTP 400 from API). */
export class SensorDataExportValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SensorDataExportValidationError';
    }
}

/** Normalize ISO datetime to ClickHouse-friendly format (YYYY-MM-DD HH:MM:SS) for query params. */
function toClickHouseDateTime(isoOrDate: string | Date): string {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

type ChClient = ReturnType<typeof getClickHouseClient>;

interface BuiltSensorDataQuery {
    mvConfig: MVConfig;
    client: ChClient;
    whereClause: string;
    queryParams: Record<string, string | number>;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}

function validateExportDateRange(startTime: string, endTime: string): void {
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        throw new SensorDataExportValidationError('Invalid start or end time for export.');
    }
    if (endMs <= startMs) {
        throw new SensorDataExportValidationError('End time must be after start time.');
    }
    if (endMs - startMs > RADAR_ANALYTICS_EXPORT_MAX_RANGE_MS) {
        throw new SensorDataExportValidationError(
            'You can only export data within a 31-day window. Please narrow your date range in the filter.'
        );
    }
}

function buildSensorDataQueryParts(params: SensorDataQueryParams): BuiltSensorDataQuery {
    if (!params.accountId) {
        throw new Error('accountId is required');
    }

    const mvConfig = MV_REGISTRY[params.dataType];
    if (!mvConfig) {
        throw new Error(`Unknown data type: ${params.dataType}`);
    }

    const client = getClickHouseClient();
    const timeField = mvConfig.timeField ?? 'log_creation_time';

    if (!params.startTime || !params.endTime) {
        throw new Error(
            'startTime and endTime are required. Please select a date range (Current week, Current month, or Custom).'
        );
    }
    const startTime = params.startTime;
    const endTime = params.endTime;

    const conditions: string[] = ['account_id = {accountId:String}'];
    const queryParams: Record<string, string | number> = {
        accountId: params.accountId,
    };

    if (params.deviceId) {
        conditions.push('device_id = {deviceId:String}');
        queryParams.deviceId = params.deviceId;
    }

    const macTrimmed = params.macAddress?.trim() || undefined;

    if (params.sensorId && macTrimmed) {
        conditions.push(
            '(sensor_id = {sensorId:String} OR mac_address = {macAddress:String})'
        );
        queryParams.sensorId = params.sensorId;
        queryParams.macAddress = macTrimmed;
    } else if (params.sensorId) {
        conditions.push('sensor_id = {sensorId:String}');
        queryParams.sensorId = params.sensorId;
    } else if (macTrimmed) {
        conditions.push('mac_address = {macAddress:String}');
        queryParams.macAddress = macTrimmed;
    }

    if (params.targetId) {
        conditions.push('target_id = {targetId:String}');
        queryParams.targetId = params.targetId;
    }

    conditions.push(`${timeField} >= {startTime:DateTime}`);
    queryParams.startTime = toClickHouseDateTime(startTime);

    conditions.push(`${timeField} <= {endTime:DateTime}`);
    queryParams.endTime = toClickHouseDateTime(endTime);

    if (params.search && mvConfig.searchFields.length > 0) {
        const allowed = new Set(mvConfig.searchFields);
        const requested = params.searchFields?.filter((f) => allowed.has(f)) ?? [];
        const fields = requested.length > 0 ? requested : mvConfig.searchFields;
        const searchConditions = fields.map((field) => `${field} ILIKE {search:String}`);
        conditions.push(`(${searchConditions.join(' OR ')})`);
        queryParams.search = `%${params.search}%`;
    }

    const whereClause = conditions.join(' AND ');

    const sortByCandidate = params.sortBy ?? mvConfig.defaultSort;
    const sortBy =
        mvConfig.allowedSortFields && mvConfig.allowedSortFields.length > 0
            ? mvConfig.allowedSortFields.includes(sortByCandidate)
                ? sortByCandidate
                : mvConfig.defaultSort
            : sortByCandidate;

    const sortOrder =
        params.sortOrder === 'asc' || params.sortOrder === 'desc' ? params.sortOrder : mvConfig.defaultOrder;

    return { mvConfig, client, whereClause, queryParams, sortBy, sortOrder };
}

export class SensorDataService {
    private static instance: SensorDataService;

    private constructor() {}

    static getInstance(): SensorDataService {
        if (!SensorDataService.instance) {
            SensorDataService.instance = new SensorDataService();
        }
        return SensorDataService.instance;
    }

    /**
     * Stream all matching rows as CSV (with header) from ClickHouse without buffering the full dataset in Node.
     * Enforces the same 31-day export window as the analytics UI.
     */
    async streamExportCsvWeb(params: SensorDataQueryParams): Promise<ReadableStream<Uint8Array>> {
        const b = buildSensorDataQueryParts(params);
        validateExportDateRange(params.startTime!, params.endTime!);

        const exportSql = `
            SELECT *
            FROM ${b.mvConfig.mv}
            WHERE ${b.whereClause}
            ORDER BY ${b.sortBy} ${b.sortOrder.toUpperCase()}
        `;

        const result = await b.client.query({
            query: exportSql,
            format: 'CSVWithNames',
            query_params: b.queryParams,
        });

        const encoder = new TextEncoder();
        const nodeRows = result.stream() as AsyncIterable<Array<{ text: string }>>;

        return new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for await (const rows of nodeRows) {
                        for (const row of rows) {
                            controller.enqueue(encoder.encode(`${row.text}\n`));
                        }
                    }
                    controller.close();
                } catch (e) {
                    try {
                        result.close();
                    } catch {
                        /* ignore */
                    }
                    controller.error(e instanceof Error ? e : new Error(String(e)));
                }
            },
        });
    }

    /**
     * Query sensor data from the appropriate MV (paginated JSON).
     */
    async query<T extends SensorDataRow = SensorDataRow>(params: SensorDataQueryParams): Promise<SensorDataResponse<T>> {
        const b = buildSensorDataQueryParts(params);

        const countQuery = `
            SELECT count() as total
            FROM ${b.mvConfig.mv}
            WHERE ${b.whereClause}
        `;

        const page = params.page ?? 1;
        const perPage = Math.min(params.perPage ?? 25, 100); // Max 100
        const offset = (page - 1) * perPage;

        const dataQuery = `
            SELECT *
            FROM ${b.mvConfig.mv}
            WHERE ${b.whereClause}
            ORDER BY ${b.sortBy} ${b.sortOrder.toUpperCase()}
            LIMIT {limit:UInt32}
            OFFSET {offset:UInt32}
        `;

        const dataQueryParams = {
            ...b.queryParams,
            limit: perPage,
            offset,
        };

        const dataResult = await b.client.query({
            query: dataQuery,
            query_params: dataQueryParams,
        });
        const data = (await dataResult.json()).data as T[];

        const countResult = await b.client.query({
            query: countQuery,
            query_params: b.queryParams,
        });
        const countData = (await countResult.json()).data as Array<{ total: string }>;
        const totalRecords = parseInt(countData[0]?.total ?? '0', 10);

        return {
            data,
            pagination: {
                page,
                per_page: perPage,
                total_records: totalRecords,
                total_pages: Math.ceil(totalRecords / perPage),
            },
            sort: {
                field: b.sortBy,
                order: b.sortOrder,
            },
        };
    }
}

// Export singleton instance
export const sensorDataService = SensorDataService.getInstance();
