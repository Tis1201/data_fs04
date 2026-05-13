<!-- User preclaims module: device table for redesign; lives outside ui_components_sveltekit submodule. -->
<script lang="ts">
  import { DataTable, ConfirmModal } from '$lib/design-system/components';
  import type { ColumnDef, SortState, BadgeColor } from '$lib/design-system/components';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { toast } from '$lib/stores/alertToast';

  export let preclaimId: string;
  export let hideToolbar: boolean = false;
  export let initialRecords: Array<Record<string, any>> | undefined = undefined;
  /** When false (e.g. In Progress / Completed), only View is shown; no Remove. Default true for list/draft. */
  export let allowRemove: boolean = true;
  /** When provided (e.g. on detail page), called after a device is removed so the parent can refetch/invalidate. */
  export let onRecordsUpdated: (() => void) | undefined = undefined;
  /** Preclaim's Valid Until date; used as fallback when device.expiresAt is empty. */
  export let preclaimValidUntil: Date | string | null | undefined = undefined;

  let loading = true;
  let confirmRemoveOpen = false;
  let rowToRemove: Record<string, any> | null = null;
  let removeLoading = false;
  let records: Array<Record<string, any>> = [];
  let apiPagination = { page: 1, per_page: 10, total_records: 0, total_pages: 0 };
  let apiSort = { field: 'name', order: 'asc' as 'asc' | 'desc' };
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

  function formatExpiresAt(d: Date | string | null | undefined): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  }

  $: pagination = {
    page: apiPagination.page ?? 1,
    pageSize: apiPagination.per_page ?? 10,
    totalItems: apiPagination.total_records ?? 0,
    totalPages: apiPagination.total_pages ?? 0
  };

  $: sort = {
    field: apiSort.field || 'name',
    direction: apiSort.order || 'asc'
  };

  $: columns = [
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
      id: 'expiresAt',
      header: 'Expires',
      accessor: (row: Record<string, any>) => formatExpiresAt(row.expiresAt ?? preclaimValidUntil),
      type: 'text',
      sortable: true,
      width: '120px'
    },
    {
      id: 'actions',
      header: 'Actions',
      type: 'moreMenu',
      width: '85px',
      align: 'center',
      getMenuActions: (row: Record<string, any>) => {
        const status = (row.status || '').toUpperCase();
        const isRegistered = status === 'FULFILLED' && row.deviceId;
        const actions: { id: string; label: string; onClick: () => void; color?: 'danger' }[] = [];
        if (isRegistered) {
          actions.push({
            id: 'view',
            label: 'View',
            onClick: () => goto(`/user/iot/devices/${row.deviceId}`)
          });
        }
        if (allowRemove) {
          actions.push({
            id: 'remove',
            label: 'Remove',
            color: 'danger',
            onClick: () => confirmRemove(row)
          });
        }
        return actions;
      }
    }
  ] satisfies ColumnDef[];

  function confirmRemove(row: Record<string, any>) {
    if (!browser) return;
    rowToRemove = row;
    confirmRemoveOpen = true;
  }

  $: confirmRemoveDescription = rowToRemove
    ? `Are you sure you want to remove device ${rowToRemove.wifiAddress || rowToRemove.macId || rowToRemove.name || rowToRemove.deviceId || 'this device'}? Once you remove this device from the pre-claim set, it can not be reversed.`
    : '';

  function closeRemoveModal() {
    confirmRemoveOpen = false;
    rowToRemove = null;
  }

  async function onConfirmRemove() {
    if (!rowToRemove) return;
    removeLoading = true;
    try {
      await removeDevice(rowToRemove);
    } finally {
      removeLoading = false;
    }
  }

  async function removeDevice(row: Record<string, any>) {
    if (!browser || !preclaimId || !row?.id) return;
    try {
      const res = await fetch(`/api/v2/preclaims/${preclaimId}/devices/${row.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        closeRemoveModal();
        if (initialRecords != null) {
          onRecordsUpdated?.();
        } else {
          await loadData();
          onRecordsUpdated?.();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        const message = err?.error?.message || res.statusText || 'Remove failed';
        toast.error(message);
      }
    } catch (e) {
      console.error('Remove device failed:', e);
      toast.error('Failed to remove device. Please try again.');
    }
  }

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
      // Optimistic update so the arrow icon reflects the click immediately,
      // before the API fetch completes and apiSort is confirmed.
      apiSort = { field: next.field, order: next.direction as 'asc' | 'desc' };
    } else {
      url.searchParams.delete('sort_field');
      url.searchParams.delete('sort_order');
      apiSort = { field: 'name', order: 'asc' };
    }
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
  }

  function handlePageChange(e: CustomEvent<number>) {
    const url = new URL($page.url.href);
    url.searchParams.set('page', String(e.detail));
    goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
  }

  function handlePageSizeChange(e: CustomEvent<number>) {
    const url = new URL($page.url.href);
    url.searchParams.set('per_page', String(e.detail));
    url.searchParams.set('page', '1');
    goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
  }
</script>

<ConfirmModal
  open={confirmRemoveOpen}
  title="Remove device"
  description={confirmRemoveDescription}
  confirmText="Remove"
  cancelText="Cancel"
  confirmLoading={removeLoading}
  confirmDisabled={removeLoading}
  on:close={closeRemoveModal}
  on:confirm={onConfirmRemove}
/>

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
