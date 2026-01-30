<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { toast } from '$lib/stores/alertToast';
    import { Button, InputField, DataTable, Modal, Dropdown } from '$lib/design-system/components';
    import type { BadgeColor, SortState } from '$lib/design-system/components';
    import { Search, Filter, Plus } from 'lucide-svelte';
    import { canCreate } from '$lib/utils/permissions';
    import type { PageData } from './$types';
    import type { Sensor } from '@prisma/client';

    export let data: PageData;

    type SensorRow = Sensor & { controller?: { id: string } | null };

    $: showCreateButton = canCreate(data.modulePermissions, 'USER_CONTROLLERS_RADAR', data.user?.systemRole);

    // Search: bind to local value, debounce then sync to URL
    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    let selectedRows: SensorRow[] = [];

    // Delete confirmation modal (per design: red icon, title, message, Cancel + Delete)
    let sensorToDelete: SensorRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;

    function openDeleteModal(row: SensorRow) {
        sensorToDelete = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        sensorToDelete = null;
    }

    async function confirmDeleteSensor() {
        if (!sensorToDelete) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', sensorToDelete.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Sensor deleted successfully!');
                closeDeleteModal();
                await invalidate('app:userControllersRadar');
                goto($page.url.pathname + $page.url.search, { noScroll: true });
            } else {
                toast.error(result.message || 'Unable to delete sensor. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to delete sensor. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Filter modal: Status (Connection Status) + Location dropdowns per design
    let showFilterModal = false;
    const STATUS_OPTIONS = [
        { id: 'ACTIVE', label: 'Active' },
        { id: 'INACTIVE', label: 'Inactive' },
        { id: 'MAINTENANCE', label: 'Maintenance' }
    ] as const;
    let filterStatuses: string[] = $page.url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
    let filterLocations: string[] = $page.url.searchParams.get('locations')?.split(',').filter(Boolean) || [];

    $: statusDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label, type: 'checkbox' as const }))
    ];
    $: locationDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...(data.availableLocations || []).map((loc) => ({ id: loc, label: loc, type: 'checkbox' as const }))
    ];

    function applyFilter() {
        const url = new URL($page.url);
        const statuses = filterStatuses.filter((s) => s !== '__all__');
        const locations = filterLocations.filter((l) => l !== '__all__');
        if (statuses.length) url.searchParams.set('statuses', statuses.join(','));
        else url.searchParams.delete('statuses');
        if (locations.length) url.searchParams.set('locations', locations.join(','));
        else url.searchParams.delete('locations');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
        showFilterModal = false;
    }

    function clearFilter() {
        filterStatuses = [];
        filterLocations = [];
        const url = new URL($page.url);
        url.searchParams.delete('statuses');
        url.searchParams.delete('locations');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
        showFilterModal = false;
    }

    function openFilterModal() {
        filterStatuses = $page.url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
        filterLocations = $page.url.searchParams.get('locations')?.split(',').filter(Boolean) || [];
        showFilterModal = true;
    }

    // Debounced search: update URL only when user has changed search (browser only)
    $: if (browser && typeof searchValue !== 'undefined') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const url = new URL($page.url);
            if (searchValue.trim()) {
                url.searchParams.set('search', searchValue.trim());
            } else {
                url.searchParams.delete('search');
            }
            url.searchParams.set('page', '1');
            const newUrl = url.pathname + url.search;
            const currentUrl = $page.url.pathname + $page.url.search;
            if (newUrl !== currentUrl) {
                goto(newUrl, { noScroll: true });
            }
        }, 500);
    }

    // Pagination state (server meta)
    $: pagination = {
        page: data.meta?.currentPage || 1,
        pageSize: data.meta?.itemsPerPage || 10,
        totalItems: data.meta?.totalItems || 0,
        totalPages: data.meta?.totalPages || 0
    };

    // Sort state (server sort)
    $: sort = {
        field: data.sort?.field || 'createdAt',
        direction: (data.sort?.order as 'asc' | 'desc') || 'desc'
    };

    // Table data
    $: tableData = (data.radarSensors || []) as unknown as SensorRow[];

    function handleSort(event: CustomEvent<SortState>) {
        const next = event.detail;
        const url = new URL($page.url);
        if (next.field && next.direction) {
            url.searchParams.set('sort_field', next.field);
            url.searchParams.set('sort_order', next.direction);
        } else {
            url.searchParams.delete('sort_field');
            url.searchParams.delete('sort_order');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    function getControllerId(row: SensorRow): string {
        return (row.controller?.id ?? row.id) as string;
    }

    // Status display: design shows "Online" (green), "Offline", "Maintenance"
    function statusLabel(status: string): string {
        if (status === 'ACTIVE') return 'Online';
        if (status === 'INACTIVE') return 'Offline';
        return status === 'MAINTENANCE' ? 'Maintenance' : status;
    }

    function statusColor(_value: string, row: SensorRow): BadgeColor {
        const s = row.status;
        if (s === 'ACTIVE') return 'success';
        if (s === 'INACTIVE') return 'gray';
        if (s === 'MAINTENANCE') return 'warning';
        return 'gray';
    }

    // Column widths: fixed px like Devices table for consistent look
    $: columns = [
        {
            id: 'name',
            header: 'Sensor Name',
            accessor: (row: SensorRow) => row.name ?? '',
            type: 'text' as const,
            sortable: true,
            width: '220px'
        },
        {
            id: 'location',
            header: 'Location',
            accessor: (row: SensorRow) => row.location ?? 'N/A',
            type: 'text' as const,
            sortable: true,
            width: '150px'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row: SensorRow) => statusLabel(row.status),
            type: 'badge' as const,
            sortable: true,
            statusColor,
            width: '120px'
        },
        {
            id: 'updatedAt',
            header: 'Last Seen',
            accessor: (row: SensorRow) => row.updatedAt ?? row.createdAt,
            type: 'relativeTime' as const,
            sortable: true,
            width: '150px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu' as const,
            width: '80px',
            getMenuActions: (row: SensorRow) => {
                const controllerId = getControllerId(row);
                return [
                    {
                        id: 'live-preview',
                        label: 'Live Preview',
                        onClick: () => goto(`/user/controllers/radar/${controllerId}`)
                    },
                    {
                        id: 'view',
                        label: 'View',
                        onClick: () => goto(`/user/controllers/radar/${controllerId}`)
                    },
                    {
                        id: 'edit',
                        label: 'Edit',
                        onClick: () => goto(`/user/controllers/radar/${controllerId}`)
                    },
                    {
                        id: 'delete',
                        label: 'Delete',
                        color: 'danger' as const,
                        onClick: (row: SensorRow) => openDeleteModal(row)
                    }
                ];
            }
        }
    ];

    function handleRowClick(event: CustomEvent<{ row: SensorRow; index: number }>) {
        const controllerId = getControllerId(event.detail.row);
        goto(`/user/controllers/radar/${controllerId}`);
    }
</script>

<!-- Main wrap: same layout as devices listing (padding 24px, gap 16px) -->
<div class="flex flex-col items-start" style="padding: 24px; gap: 16px;">
    <!-- Search & filter bar: gap 16px, height 48px -->
    <div class="flex flex-row items-center" style="gap: 16px; height: 48px; width: 100%;">
        <div style="width: 500px; height: 48px;">
            <InputField
                type="search"
                placeholder="Search by Device name"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>

        <div style="flex: 1;"></div>

        <Button
            variant="outline"
            color="gray"
            size="lg"
            iconOnly={true}
            icon={Filter}
            iconPosition="only"
            on:click={openFilterModal}
        />

        {#if showCreateButton}
            <Button
                variant="filled"
                color="primary"
                size="lg"
                iconLeft={true}
                on:click={() => goto('/user/controllers/radar/new')}
                style="width: 156px; height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
            >
                <Plus size={20} slot="icon-left" />
                Register Device
            </Button>
        {/if}
    </div>

    <!-- Table width per design: ~70–80% of content area, not full width -->
    <div class="w-full">
        <DataTable
            {columns}
            data={tableData}
            keyField="id"
            selectable={true}
            checkboxColumnWidth="48px"
            bind:selectedRows
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage="No sensors found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
            on:rowClick={handleRowClick}
        />
    </div>
</div>

<!-- Filter Modal: Connection Status + Location dropdowns per design -->
<Modal
    open={showFilterModal}
    title="Filter"
    size="md"
    showFooter={false}
    on:close={() => (showFilterModal = false)}
>
    <div class="flex flex-col gap-5 w-full min-w-0">
        <div class="flex flex-col gap-2 w-full min-w-0">
            <span class="text-sm font-medium text-[var(--ds-text-primary)]">Connection Status</span>
            <Dropdown
                label=""
                placeholder="Select"
                options={statusDropdownOptions}
                bind:value={filterStatuses}
                multiple={true}
                width="100%"
            />
        </div>
        <div class="flex flex-col gap-2 w-full min-w-0">
            <span class="text-sm font-medium text-[var(--ds-text-primary)]">Location</span>
            <Dropdown
                label=""
                placeholder="Select"
                options={locationDropdownOptions}
                bind:value={filterLocations}
                multiple={true}
                width="100%"
            />
        </div>
    </div>
    <div slot="footer" class="flex justify-end gap-3">
        <Button variant="text" color="primary" on:click={clearFilter}>
            Clear All
        </Button>
        <Button variant="filled" color="primary" on:click={applyFilter}>
            Apply
        </Button>
    </div>
</Modal>

<!-- Delete confirmation modal (per design: red icon, title, message, Cancel + Delete) -->
<Modal
    open={showDeleteModal}
    title="Delete Sensor"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDeleteSensor}
>
    <p class="text-[var(--ds-text-secondary)]">
        Are you sure you want to delete this sensor? This action cannot be reversed.
    </p>
</Modal>
