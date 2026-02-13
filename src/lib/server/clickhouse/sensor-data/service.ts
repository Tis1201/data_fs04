/**
 * Sensor Data Service
 *
 * Generic service for querying ClickHouse MVs for sensor data.
 * Enforces account_id scoping at the service layer.
 */

import { getClickHouseClient } from '../client';
import {
    MV_REGISTRY,
    type SensorDataQueryParams,
    type SensorDataResponse,
    type SensorDataRow,
} from './types';

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

export class SensorDataService {
    private static instance: SensorDataService;

    private constructor() { }

    static getInstance(): SensorDataService {
        if (!SensorDataService.instance) {
            SensorDataService.instance = new SensorDataService();
        }
        return SensorDataService.instance;
    }

    /**
     * Query sensor data from the appropriate MV
     */
    async query<T extends SensorDataRow = SensorDataRow>(
        params: SensorDataQueryParams
    ): Promise<SensorDataResponse<T>> {
        // Validate required params
        if (!params.accountId) {
            throw new Error('accountId is required');
        }

        const mvConfig = MV_REGISTRY[params.dataType];
        if (!mvConfig) {
            throw new Error(`Unknown data type: ${params.dataType}`);
        }

        const client = getClickHouseClient();
        const timeField = mvConfig.timeField ?? 'log_creation_time';

        // Date range is required from the UI for both session and path-tracking
        if (!params.startTime || !params.endTime) {
            throw new Error('startTime and endTime are required. Please select a date range (Current week, Current month, or Custom).');
        }
        const startTime = params.startTime;
        const endTime = params.endTime;

        // Build WHERE conditions
        const conditions: string[] = ['account_id = {accountId:String}'];
        const queryParams: Record<string, string | number> = {
            accountId: params.accountId,
        };

        if (params.deviceId) {
            conditions.push('device_id = {deviceId:String}');
            queryParams.deviceId = params.deviceId;
        }

        if (params.sensorId) {
            conditions.push('sensor_id = {sensorId:String}');
            queryParams.sensorId = params.sensorId;
        }

        if (params.targetId) {
            conditions.push('target_id = {targetId:String}');
            queryParams.targetId = params.targetId;
        }

        if (startTime) {
            conditions.push(`${timeField} >= {startTime:DateTime}`);
            queryParams.startTime = toClickHouseDateTime(startTime);
        }

        if (endTime) {
            conditions.push(`${timeField} <= {endTime:DateTime}`);
            queryParams.endTime = toClickHouseDateTime(endTime);
        }

        // Search across configured fields
        if (params.search && mvConfig.searchFields.length > 0) {
            const searchConditions = mvConfig.searchFields.map(
                (field) => `${field} ILIKE {search:String}`
            );
            conditions.push(`(${searchConditions.join(' OR ')})`);
            queryParams.search = `%${params.search}%`;
        }

        const whereClause = conditions.join(' AND ');

        // Pagination
        const page = params.page ?? 1;
        const perPage = Math.min(params.perPage ?? 25, 100); // Max 100
        const offset = (page - 1) * perPage;

        // Sorting
        const sortByCandidate = params.sortBy ?? mvConfig.defaultSort;
        const sortBy =
            mvConfig.allowedSortFields && mvConfig.allowedSortFields.length > 0
                ? (mvConfig.allowedSortFields.includes(sortByCandidate) ? sortByCandidate : mvConfig.defaultSort)
                : sortByCandidate;

        const sortOrder =
            params.sortOrder === 'asc' || params.sortOrder === 'desc'
                ? params.sortOrder
                : mvConfig.defaultOrder;

        // Execute data query
        const dataQuery = `
            SELECT *
            FROM ${mvConfig.mv}
            WHERE ${whereClause}
            ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
            LIMIT {limit:UInt32}
            OFFSET {offset:UInt32}
        `;

        queryParams.limit = perPage;
        queryParams.offset = offset;

        const dataResult = await client.query({
            query: dataQuery,
            query_params: queryParams,
        });
        const data = (await dataResult.json()).data as T[];

        // Execute count query (reuse conditions, no pagination)
        const countQuery = `
            SELECT count() as total
            FROM ${mvConfig.mv}
            WHERE ${whereClause}
        `;

        // Remove pagination params for count
        const countParams = { ...queryParams };
        delete countParams.limit;
        delete countParams.offset;

        const countResult = await client.query({
            query: countQuery,
            query_params: countParams,
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
                field: sortBy,
                order: sortOrder,
            },
        };
    }
}

// Export singleton instance
export const sensorDataService = SensorDataService.getInstance();
