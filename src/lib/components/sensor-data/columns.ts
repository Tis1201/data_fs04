/**
 * Column Definitions for Sensor Data Tables
 *
 * Each data type has its own column configuration.
 * Columns use the existing DataTable column format.
 */

import type { RadarSessionRow, RadarPathRow, SensorDataType } from '$lib/server/clickhouse/sensor-data/types';

// Column definition type (matches DataTable expectations)
export interface ColumnDef<T = Record<string, unknown>> {
    id: string;
    label: string;
    sortable?: boolean;
    width?: string;
    render?: (row: T) => string | { component: unknown; props: Record<string, unknown> };
}

// ============================================================================
// Radar Session Columns
// ============================================================================

export const RadarSessionColumns: ColumnDef<RadarSessionRow>[] = [
    {
        id: 'log_creation_time',
        label: 'Time',
        sortable: true,
        width: '18%',
    },
    {
        id: 'target_id',
        label: 'Target ID',
        sortable: true,
        width: '22%',
        render: (row) => row.target_id.slice(0, 8) + '...',
    },
    {
        id: 'dwell_tracking_area_sec',
        label: 'Dwell (sec)',
        sortable: true,
        width: '12%',
        render: (row) => row.dwell_tracking_area_sec.toFixed(1),
    },
    {
        id: 'proximity_m',
        label: 'Proximity (m)',
        sortable: true,
        width: '12%',
        render: (row) => (row.proximity_m !== null ? row.proximity_m.toFixed(2) : '—'),
    },
    {
        id: 'sensor_name',
        label: 'Sensor',
        sortable: true,
        width: '20%',
    },
    {
        id: 'timezone_label',
        label: 'Timezone',
        sortable: false,
        width: '16%',
    },
];

// ============================================================================
// Radar Path Columns
// ============================================================================

export const RadarPathColumns: ColumnDef<RadarPathRow>[] = [
    {
        id: 'log_creation_time',
        label: 'Time',
        sortable: true,
        width: '20%',
    },
    {
        id: 'target_id',
        label: 'Target ID',
        sortable: true,
        width: '25%',
        render: (row) => row.target_id.slice(0, 8) + '...',
    },
    {
        id: 'x_m',
        label: 'X (m)',
        sortable: true,
        width: '12%',
        render: (row) => row.x_m.toFixed(2),
    },
    {
        id: 'y_m',
        label: 'Y (m)',
        sortable: true,
        width: '12%',
        render: (row) => row.y_m.toFixed(2),
    },
    {
        id: 'sensor_name',
        label: 'Sensor',
        sortable: true,
        width: '18%',
    },
    {
        id: 'timezone_label',
        label: 'Timezone',
        sortable: false,
        width: '13%',
    },
];

// ============================================================================
// Column Registry
// ============================================================================

export const COLUMN_REGISTRY: Record<SensorDataType, ColumnDef[]> = {
    radar_session: RadarSessionColumns as unknown as ColumnDef[],
    radar_path: RadarPathColumns as unknown as ColumnDef[],
};

export function getColumnsForDataType(dataType: SensorDataType): ColumnDef[] {
    return COLUMN_REGISTRY[dataType] ?? [];
}
