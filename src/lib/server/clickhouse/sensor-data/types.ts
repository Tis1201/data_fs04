/**
 * Sensor Data Types and MV Registry
 *
 * Central types for the SensorDataTable component and SensorDataService.
 */

// ============================================================================
// Data Type Registry
// ============================================================================

export type SensorDataType = 'radar_session' | 'radar_path';

export interface MVConfig {
    mv: string;                    // ClickHouse MV name
    defaultSort: string;           // Default sort column
    defaultOrder: 'asc' | 'desc';  // Default sort order
    searchFields: string[];        // Fields to search
}

export const MV_REGISTRY: Record<SensorDataType, MVConfig> = {
    radar_session: {
        mv: 'mv_radar_session',
        defaultSort: 'log_creation_time',
        defaultOrder: 'desc',
        searchFields: ['target_id', 'sensor_id', 'sensor_name'],
    },
    radar_path: {
        mv: 'mv_radar_path',
        defaultSort: 'log_creation_time',
        defaultOrder: 'desc',
        searchFields: ['target_id', 'sensor_id'],
    },
};

// ============================================================================
// Query Parameters
// ============================================================================

export interface SensorDataQueryParams {
    dataType: SensorDataType;
    accountId: string;             // REQUIRED - enforced at service layer
    deviceId?: string;
    sensorId?: string;
    targetId?: string;
    search?: string;
    startTime?: string;            // ISO timestamp
    endTime?: string;              // ISO timestamp
    page?: number;
    perPage?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Response Types
// ============================================================================

export interface PaginationInfo {
    page: number;
    per_page: number;
    total_records: number;
    total_pages: number;
}

export interface SortInfo {
    field: string;
    order: 'asc' | 'desc';
}

export interface SensorDataResponse<T = Record<string, unknown>> {
    data: T[];
    pagination: PaginationInfo;
    sort: SortInfo;
}

// ============================================================================
// Row Types (from MVs)
// ============================================================================

export interface RadarSessionRow {
    processed_at: string;
    account_id: string;
    device_id: string;
    log_creation_time: string;
    timezone_offset: number;
    timezone_label: string;
    sensor_id: string;
    sensor_name: string;
    mac_address: string;
    target_id: string;
    dwell_tracking_area_sec: number;
    zone_dwell_times_json: string;
    proximity_m: number | null;
}

export interface RadarPathRow {
    processed_at: string;
    account_id: string;
    device_id: string;
    log_creation_time: string;
    timezone_offset: number;
    timezone_label: string;
    sensor_id: string;
    sensor_name: string;
    mac_address: string;
    target_id: string;
    x_m: number;
    y_m: number;
}

// Union type for all sensor data rows
export type SensorDataRow = RadarSessionRow | RadarPathRow;
