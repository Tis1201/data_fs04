<script lang="ts">
  import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
  import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
  import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
  import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
  import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  // Props
  export let preclaimId: string;

  // State
  let loading = true;
  let records: Array<any> = [];
  let pagination = { page: 1, per_page: 10, total_records: 0, total_pages: 0 };
  let sort: { field: string; order: "asc" | "desc" } = { field: "createdAt", order: "desc" };
  let lastSearch = '';

  // Filters
  const statusOptions = [
    { label: "All Statuses", value: "" },
    { label: "Pending", value: "PENDING" },
    { label: "Claimed", value: "CLAIMED" },
    { label: "Assigned", value: "ASSIGNED" },
    { label: "Used", value: "USED" }
  ];

  // Columns
  const columns = [
    {
      id: "id",
      label: "ID",
      sortable: true,
      render: (row: any) => row.id
    },
    {
      id: "device",
      label: "Device",
      sortable: true,
      render: (row: any) => row.deviceId || row.name || row.macId || "—"
    },
    {
      id: "status",
      label: "Status",
      sortable: true,
      render: (row: any) => `<span class=\"inline-block whitespace-nowrap text-xs font-medium rounded-full px-2 py-0.5 border ${getStatusTextBorderClasses(row.status)}\">${getStatusLabel(row.status)}</span>`
    },
    {
      id: "claimedAt",
      label: "Claimed At",
      sortable: true,
      render: (row: any) => row.claimedAt ? { component: RelativeDate, props: { date: row.claimedAt } } : "—"
    },
    {
      id: "createdAt",
      label: "Created",
      sortable: true,
      render: (row: any) => ({ component: RelativeDate, props: { date: row.createdAt } })
    }
  ];

  function getStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Unknown';
    const map: Record<string, string> = {
      PENDING: 'Pending',
      CLAIMED: 'Claimed',
      ASSIGNED: 'Assigned',
      USED: 'Used'
    };
    return map[status] || String(status);
  }

  function getStatusTextBorderClasses(status: string | null | undefined): string {
    if (!status) return 'text-zinc-700 border-zinc-200';
    const map: Record<string, string> = {
      PENDING: 'text-zinc-700 border-zinc-300',
      CLAIMED: 'text-green-700 border-green-200',
      ASSIGNED: 'text-blue-700 border-blue-300',
      USED: 'text-green-700 border-green-200'
    };
    return map[status] || 'text-zinc-800 border-zinc-200';
  }

  // Core fetch used by both hard/soft loads
  async function fetchDataCore() {
    const url = new URL(window.location.href);
    const q = new URLSearchParams(url.search);
    const pageParam = q.get('page') || '1';
    const perPageParam = q.get('per_page') || '10';
    const sortField = q.get('sort_field') || sort.field;
    const sortOrder = (q.get('sort_order') || sort.order) as 'asc' | 'desc';
    const search = q.get('search') || '';
    const status = q.get('status') || '';

    const apiUrl = new URL(`/user/iot/preclaims/${preclaimId}/claims`, window.location.origin);
    apiUrl.searchParams.set('page', pageParam);
    apiUrl.searchParams.set('per_page', perPageParam);
    apiUrl.searchParams.set('sort_field', sortField);
    apiUrl.searchParams.set('sort_order', sortOrder);
    if (search) apiUrl.searchParams.set('search', search);
    if (status) apiUrl.searchParams.set('status', status);

    const resp = await fetch(apiUrl.toString(), { credentials: 'include' });
    if (!resp.ok) {
      return null;
    }
    return await resp.json();
  }

  // Hard load shows skeleton
  async function loadData() {
    if (!browser) return;
    loading = true;
    const data = await fetchDataCore();
    if (!data) {
      loading = false;
      return;
    }
    records = data.records || [];
    pagination = data.pagination || pagination;
    sort = data.sort || sort;
    loading = false;
  }

  // Soft load avoids toggling skeleton (used for search typing)
  async function loadDataSoft() {
    if (!browser) return;
    const data = await fetchDataCore();
    if (!data) return;
    records = data.records || [];
    pagination = data.pagination || pagination;
    sort = data.sort || sort;
  }

  // Initial fetch
  onMount(loadData);

  // React to URL changes for filters/pagination/sort
  $: if (browser) {
    const currentSearch = $page.url.searchParams.get('search') || '';
    if (currentSearch !== lastSearch) {
      lastSearch = currentSearch;
      loadDataSoft();
    } else {
      loadData();
    }
  }

  // Event handlers similar to other tables
  function handleSort(e: CustomEvent<{ field: string; order: 'asc' | 'desc' }>) {
    const url = new URL(window.location.href);
    url.searchParams.set('sort_field', e.detail.field);
    url.searchParams.set('sort_order', e.detail.order);
    goto(url.toString(), { replaceState: true, noScroll: true });
  }

  function handlePagination(e: CustomEvent<{ page: number; per_page: number }>) {
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(e.detail.page));
    url.searchParams.set('per_page', String(e.detail.per_page));
    goto(url.toString(), { replaceState: true, noScroll: true });
  }
</script>

<div class="space-y-4">
  {#if loading}
    <LoadingSkeleton />
  {:else}
    <div class="flex flex-wrap gap-2 mb-4">
      <div class="w-1/3">
        <DebouncedTextFilter
          placeholder="Search claims..."
          paramName="search"
          value={$page.url.searchParams.get('search') || ''}
        />
      </div>
      <PopoverFilter
        label="Status"
        options={statusOptions.filter(o => o.value !== '')}
        selectedValues={$page.url.searchParams.get('status') ? [$page.url.searchParams.get('status') || ''] : []}
        onChange={(values) => {
          const url = new URL(window.location.href);
          if (values.length && values[0]) url.searchParams.set('status', values[0]);
          else url.searchParams.delete('status');
          url.searchParams.set('page', '1');
          goto(url.toString(), { replaceState: true, noScroll: true });
        }}
      />
    </div>

    <DataTable
      props={{ records, pagination, sort }}
      columns={columns}
      on:sort={handleSort}
      on:pagination={handlePagination}
    />
  {/if}
</div>
