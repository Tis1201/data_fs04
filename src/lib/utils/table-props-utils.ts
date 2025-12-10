// Add this to src/lib/components/ui_components_sveltekit/table/pagination/pagination-utils.ts

/**
 * Create standardized table props from server data
 * @param data The server data containing records, meta, and sort info
 * @param options Optional configuration for defaults and overrides
 */
export function createTableProps<T = any>(
    data: {
        meta?: {
            currentPage?: number;
            itemsPerPage?: number;
            totalItems?: number;
            totalPages?: number;
        };
        sort?: {
            field?: string;
            order?: string;
        };
        [key: string]: any;
    },
    options: {
        recordsKey?: string;
        defaultSort?: {
            field?: string;
            order?: 'asc' | 'desc';
        };
        loading?: boolean;
        additionalProps?: Record<string, any>;
    } = {}
) {
    const {
        recordsKey = 'records',
        defaultSort = { field: 'createdAt', order: 'desc' },
        loading = false,
        additionalProps = {}
    } = options;

    return {
        records: data[recordsKey] || [],
        pagination: {
            page: data.meta?.currentPage || 1,
            per_page: data.meta?.itemsPerPage || 10,
            total_records: data.meta?.totalItems || 0,
            total_pages: data.meta?.totalPages || 0
        },
        sort: {
            field: data.sort?.field || defaultSort.field,
            order: data.sort?.order || defaultSort.order
        },
        loading,
        ...additionalProps
    };
}
