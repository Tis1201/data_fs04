<!-- User preclaims module: device table for redesign; lives outside ui_components_sveltekit submodule. -->
<script lang="ts">
  import { DataTable } from '$lib/design-system/components';
  import type { ColumnDef, SortState, BadgeColor } from '$lib/design-system/components';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  export let preclaimId: string;
  export let hideToolbar: boolean = false;
  export let initialRecords: Array<Record<string, any>> | undefined = undefined;

  let loading = true;
  let records: Array<Record<string, any>> = [];
  let apiPagination = { page: 1, per_page: 10, total_records: 0, total_pages: 0 };
  let apiSort = { field: 'createdAt', order: 'desc' as 'asc' | 'desc' };
  let loadError: string | null = null;

  $: if (initialRecords != null) {
    records = Array.isArray(initialRecords) ? initialRecords : [];
    apiPagination = {
      page: 1,
      per_page: Math.max(10, records.length),
      total_records: records.length,
      total_pages: Math.max(1, Math.ceil(records.length / 10))
    };
    loading = false;
    loadError = null;
  }

  function statusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    const map: Record<string, string> = {
      PENDING: 'Pending',
      FULFILLED: 'Registered',
      EXPIRED: 'Expired',
      REVOKED: 'Revoked'
    };
    return map[status] || String(status);
  }

  function statusColor(_value: string, row: Record<string, any>): BadgeColor {
    const s = (row.status || '').toUpperCase();
    if (s === 'PENDING') return 'warning';
    if (s === 'FULFILLED') return 'success';
    if (s === 'EXPIRED') return 'gray';
    if (s === 'REVOKED') return 'error';
    return 'gray';
  }

  $: pagination = {
    page: apiPagination.page ?? 1,
    pageSize: apiPagination.per_page ?? 10,
    totalItems: apiPagination.total_records ?? 0,
    totalPages: apiPagination.total_pages ?? 0
  };

  $: sort = {
    field: apiSort.field || 'createdAt',
    direction: apiSort.order || 'desc'
  };

  const columns: ColumnDef[] = [
    {
      id: 'rowNumber',
      header: '#',
      type: 'rowNumber',
      sortable: false,
      width: '50px',
      align: 'center'
    },
    {
      id: 'name',
      header: 'Device Name',
      accessor: (row: Record<string, any>) => row.deviceId || row.name || '—',
      type: 'text',
      sortable: true,
      width: '280px'
    },
    {
      id: 'wifiAddress',
      header: 'Wifi Address',
      accessor: (row: Record<string, any>) => row.wifiAddress ?? row.macId ?? '—',
      type: 'text',
      sortable: true,
      width: '180px'
    },
    {
      id: 'lanAddress',
      header: 'LAN Address',
      accessor: (row: Record<string, any>) => row.lanAddress ?? row.macId ?? '—',
      type: 'text',
      sortable: true,
      width: '180px'
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (row: Record<string, any>) => statusLabel(row.status),
      type: 'badge',
      sortable: true,
      statusColor,
      showDot: () => true,
      width: '120px'
    },
    {
      id: 'actions',
      header: 'Actions',
      type: 'moreMenu',
      width: '85px',
      align: 'center',
      getMenuActions: (row: Record<string, any>) => [
        {
          id: 'view',
          label: 'View',
          onClick: () => { /* TODO: navigate to device view if needed */ }
        },
        {
          id: 'remove',
          label: 'Remove',
          color: 'danger',
          onClick: () => { /* TODO: remove device from preclaim */ }
        }
      ]
    }
  ];

  async function fetchData() {
    if (!browser || !preclaimId) return null;
    const url = new URL($page.url.href);
    const pageParam = url.searchParams.get('page') || '1';
    const perPageParam = url.searchParams.get('per_page') || '10';
    const sortField = url.searchParams.get('sort_field') || apiSort.field;
    const sortOrder = (url.searchParams.get('sort_order') || apiSort.order) as 'asc' | 'desc';
    const search = url.searchParams.get('search') || '';

    const apiUrl = new URL(`/api/v2/preclaims/${preclaimId}/devices`, window.location.origin);
    apiUrl.searchParams.set('page', pageParam);
    apiUrl.searchParams.set('per_page', perPageParam);
    apiUrl.searchParams.set('sort_field', sortField);
    apiUrl.searchParams.set('sort_order', sortOrder);
    if (search) apiUrl.searchParams.set('search', search);

    const resp = await fetch(apiUrl.toString(), { credentials: 'include' });
    let raw: unknown;
    try {
      raw = await resp.json();
    } catch {
      return { records: [], pagination: apiPagination, sort: { field: sortField, order: sortOrder }, error: 'Invalid response' };
    }
    // API returns { records, pagination, sort } at top level (no wrapper)
    const obj = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
    const records = Array.isArray(obj.records) ? obj.records : (Array.isArray(obj.devices) ? obj.devices : []);
    const pagination = obj.pagination && typeof obj.pagination === 'object' && obj.pagination !== null
      ? { ...apiPagination, ...(obj.pagination as Record<string, unknown>) }
      : apiPagination;
    const sortObj = obj.sort && typeof obj.sort === 'object' && obj.sort !== null ? obj.sort as Record<string, unknown> : {};
    const sort = {
      field: (sortObj.field as string) ?? sortField,
      order: ((sortObj.order as string) ?? sortOrder) as 'asc' | 'desc'
    };
    return {
      records,
      pagination,
      sort,
      error: !resp.ok ? `Request failed (${resp.status})` : null
    };
  }

  async function loadData() {
    if (!browser) return;
    if (initialRecords != null) return;
    loading = true;
    loadError = null;
    const data = await fetchData();
    if (data) {
      records = data.records ?? [];
      apiPagination = data.pagination ?? apiPagination;
      apiSort = data.sort ?? apiSort;
      if (data.error) loadError = data.error;
    }
    loading = false;
  }

  $: urlKey = browser && $page.url.pathname + $page.url.search;
  $: if (browser && preclaimId && urlKey && initialRecords == null) {
    loadData();
  }

  function handleSort(e: CustomEvent<SortState>) {
    const next = e.detail;
    const url = new URL($page.url.href);
    if (next.field && next.direction) {
      url.searchParams.set('sort_field', next.field);
      url.searchParams.set('sort_order', next.direction);
    } else {
      url.searchParams.delete('sort_field');
      url.searchParams.delete('sort_order');
    }
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true, noScroll: true });
  }

  function handlePageChange(e: CustomEvent<number>) {
    const url = new URL($page.url.href);
    url.searchParams.set('page', String(e.detail));
    goto(url.toString(), { replaceState: true, noScroll: true });
  }

  function handlePageSizeChange(e: CustomEvent<number>) {
    const url = new URL($page.url.href);
    url.searchParams.set('per_page', String(e.detail));
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true, noScroll: true });
  }
</script>

<DataTable
  columns={columns}
  data={records}
  keyField="id"
  sortable={true}
  sort={sort}
  paginated={true}
  pagination={pagination}
  pageSizeOptions={[5, 10, 25, 50, 100]}
  loading={loading}
  emptyMessage={loadError || 'No records available'}
  bordered={true}
  cellBorders={true}
  hoverable={true}
  on:sort={handleSort}
  on:pageChange={handlePageChange}
  on:pageSizeChange={handlePageSizeChange}
/>
