<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { toast } from '$lib/stores/alertToast';
    import { Button, InputField, DataTable, Modal, Dropdown } from '$lib/design-system/components';
    import type { BadgeColor, SortState } from '$lib/design-system/components';
    import { Search, Filter, Plus } from 'lucide-svelte';
    import type { PageData } from './$types';
    import AddEditProfileModal from './components/AddEditProfileModal.svelte';

    export let data: PageData;
    /** From layout/route – accept to avoid "unknown prop" warning */
    export let params: Record<string, string> = {};

    interface DeviceProfileRow {
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date | string;
        account: { id: string; name: string };
        _count: { assignments: number };
    }

    $: profiles = (data.profiles || []) as DeviceProfileRow[];
    $: meta = data.meta || {};
    $: serverPagination = meta.pagination || {};
    $: serverSort = meta.sort || { field: 'createdAt', order: 'desc' };

    // Search: bind to local value, debounce then sync to URL
    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    // Add / Edit Profile modals
    let showAddProfileModal = false;
    let showEditProfileModal = false;
    let editProfileRow: DeviceProfileRow | null = null;

    // Delete confirmation modal
    let profileToDelete: DeviceProfileRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;

    function openAddProfileModal() {
        showAddProfileModal = true;
    }

    function openEditProfileModal(row: DeviceProfileRow) {
        editProfileRow = row;
        showEditProfileModal = true;
    }

    function closeAddProfileModal() {
        showAddProfileModal = false;
    }

    function closeEditProfileModal() {
        showEditProfileModal = false;
        editProfileRow = null;
    }

    function onAddProfileSuccess() {
        toast.success('Profile added successfully!');
        closeAddProfileModal();
        invalidate('app:userDeviceProfiles');
        goto($page.url.pathname + $page.url.search, { noScroll: true, keepFocus: true });
    }

    function onEditProfileSuccess() {
        toast.success('Profile updated successfully!');
        closeEditProfileModal();
        invalidate('app:userDeviceProfiles');
        goto($page.url.pathname + $page.url.search, { noScroll: true, keepFocus: true });
    }

    const ADD_PROFILE_ERROR_MSG = 'Unable to add Profile. Please try again!';
    const UPDATE_PROFILE_ERROR_MSG = 'Unable to update Profile. Please try again!';

    function isGenericError(msg: string | null): boolean {
        if (!msg?.trim()) return true;
        const lower = msg.toLowerCase();
        return lower === 'internal error' || lower === 'request failed' || lower.includes('internal server error') || lower === 'error';
    }

    function onAddProfileError(message: string | unknown) {
        const text = typeof message === 'string' ? message : (message && typeof message === 'object' && 'message' in message && typeof (message as { message: unknown }).message === 'string' ? (message as { message: string }).message : null);
        toast.error(isGenericError(text) ? ADD_PROFILE_ERROR_MSG : text);
    }

    function onEditProfileError(message: string | unknown) {
        const text = typeof message === 'string' ? message : (message && typeof message === 'object' && 'message' in message && typeof (message as { message: unknown }).message === 'string' ? (message as { message: string }).message : null);
        toast.error(isGenericError(text) ? UPDATE_PROFILE_ERROR_MSG : text);
    }

    function openDeleteModal(row: DeviceProfileRow) {
        profileToDelete = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        profileToDelete = null;
    }

    async function confirmDeleteProfile() {
        if (!profileToDelete) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', profileToDelete.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Profile deleted successfully.');
                closeDeleteModal();
                await invalidate('app:userDeviceProfiles');
                goto($page.url.pathname + $page.url.search, { noScroll: true, keepFocus: true });
            } else {
                toast.error(result.message || 'Unable to delete Profile. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to delete Profile. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Filter modal: Status (Active / Inactive) – aligned with pin-rules pattern
    let showFilterModal = false;
    const STATUS_OPTIONS = [
        { id: 'active', label: 'Active' },
        { id: 'inactive', label: 'Inactive' }
    ] as const;
    let filterStatuses: string[] = $page.url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];

    $: statusDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label, type: 'checkbox' as const }))
    ];

    // All and specific options (Active/Inactive) are mutually exclusive – same as pin-rules
    function handleStatusFilterChange(e: CustomEvent<string | string[]>) {
        const val = e.detail;
        const arr = Array.isArray(val) ? val : (val ? [val] : []);
        if (arr.includes('__all__') && !filterStatuses.includes('__all__')) {
            filterStatuses = ['__all__'];
            return;
        }
        if (!arr.includes('__all__') && filterStatuses.includes('__all__')) {
            filterStatuses = arr.length > 0 ? arr : ['__all__'];
            return;
        }
        if (arr.some((v) => v !== '__all__')) {
            filterStatuses = arr.filter((v) => v !== '__all__');
            return;
        }
        filterStatuses = arr.length > 0 ? arr : ['__all__'];
    }

    function applyFilter() {
        const url = new URL($page.url);
        const statuses = filterStatuses.filter((s) => s !== '__all__');
        if (statuses.length) url.searchParams.set('statuses', statuses.join(','));
        else url.searchParams.delete('statuses');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
        showFilterModal = false;
    }

    function clearFilter() {
        filterStatuses = [];
        const url = new URL($page.url);
        url.searchParams.delete('statuses');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
        showFilterModal = false;
    }

    function openFilterModal() {
        // Include __all__ from URL so "All" selection is retained when reopening (same as pin-rules)
        const statusesParam = $page.url.searchParams.get('statuses');
        filterStatuses = statusesParam ? statusesParam.split(',').filter(Boolean) : ['__all__'];
        showFilterModal = true;
    }

    // Debounced search: only goto when search param actually changed (avoids resetting page after pagination click)
    $: if (browser && typeof searchValue !== 'undefined') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const currentSearch = $page.url.searchParams.get('search') || '';
            const newSearch = searchValue.trim();
            if (newSearch === currentSearch) return;
            const url = new URL($page.url);
            if (newSearch) {
                url.searchParams.set('search', newSearch);
            } else {
                url.searchParams.delete('search');
            }
            url.searchParams.set('page', '1');
            goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
        }, 500);
    }

    // Pagination state (server meta: page, per_page, total_records, total_pages)
    $: pagination = {
        page: serverPagination.page ?? 1,
        pageSize: serverPagination.per_page ?? 10,
        totalItems: serverPagination.total_records ?? 0,
        totalPages: serverPagination.total_pages ?? 0
    };

    // Sort state (server: sort.field, sort.order). When server returns '', use null so third-click "clear" works.
    $: sort = {
        field: serverSort.field && serverSort.field !== '' ? serverSort.field : null,
        direction: serverSort.order && serverSort.order !== '' ? (serverSort.order as 'asc' | 'desc') : null
    };

    const basePath = '/user/iot';

    function escapeHtml(s: string): string {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function handleSort(event: CustomEvent<SortState>) {
        const next = event.detail;
        const url = new URL($page.url);
        if (next.field && next.direction) {
            url.searchParams.set('sort', next.field);
            url.searchParams.set('order', next.direction);
        } else {
            url.searchParams.delete('sort');
            url.searchParams.delete('order');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
    }

    function statusColor(_value: string, row: DeviceProfileRow): BadgeColor {
        return row.isActive ? 'success' : 'gray';
    }

    $: columns = [
        {
            id: 'name',
            header: 'Name',
            accessor: (row: DeviceProfileRow) => row.name || '',
            type: 'custom' as const,
            sortable: true,
            width: '280px',
            render: (_value: unknown, row: DeviceProfileRow) => {
                const name = row.name || '—';
                const desc = row.description || '';
                /* TC-RDM-PR-0087: Truncate long name/description to prevent layout overflow */
                const truncateStyle = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; min-width: 0;';
                const link = `<a href="${basePath}/device-profiles/${row.id}" class="profile-name-link text-[14px] font-medium text-[var(--ds-text-link)] hover:text-[var(--ds-text-link-hover)] hover:underline block" style="${truncateStyle}" title="${escapeHtml(name)}">${escapeHtml(name)}</a>`;
                const idLine = row.id ? `<div style="font-family: var(--ds-font-family-primary); font-size: 12px; color: var(--ds-color-gray-500); margin-top: 2px; ${truncateStyle}" title="${escapeHtml(row.id)}">${escapeHtml(row.id)}</div>` : '';
                const descLine = desc ? `<span class="text-[14px] font-normal leading-5 text-[var(--ds-text-tertiary)] block" style="${truncateStyle} margin-top: 2px;" title="${escapeHtml(desc)}">${escapeHtml(desc)}</span>` : '';
                return `<div class="profile-name-cell flex flex-col gap-0 min-w-0 overflow-hidden" style="max-width: 100%;"><span style="min-width: 0;">${link}</span>${idLine}${descLine ? `<span style="min-width: 0;">${descLine}</span>` : ''}</div>`;
            }
        },
        {
            id: 'assignments',
            header: 'Assigned Devices',
            accessor: (row: DeviceProfileRow) => row._count?.assignments ?? 0,
            type: 'number' as const,
            width: '140px'
        },
        {
            id: 'createdAt',
            header: 'Created On',
            accessor: (row: DeviceProfileRow) => row.createdAt,
            type: 'datetime' as const,
            sortable: true,
            width: '180px'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row: DeviceProfileRow) => (row.isActive ? 'Active' : 'Inactive'),
            type: 'badge' as const,
            sortable: true,
            statusColor,
            showDot: (value: string) => value === 'Active' || value === 'Inactive',
            width: '120px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu' as const,
            width: '80px',
            getMenuActions: (row: DeviceProfileRow) => [
                {
                    id: 'view',
                    label: 'View',
                    onClick: () => goto(`${basePath}/device-profiles/${row.id}`)
                },
                {
                    id: 'edit',
                    label: 'Edit',
                    onClick: () => openEditProfileModal(row)
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    color: 'danger' as const,
                    onClick: (r: DeviceProfileRow) => openDeleteModal(r)
                }
            ]
        }
    ];
</script>

<div class="flex flex-col items-start" style="padding: 24px; gap: 16px;">
    <div class="flex flex-row items-center" style="gap: 16px; height: 48px; width: 100%;">
        <div style="width: 500px; height: 48px;">
            <InputField
                type="search"
                placeholder="Search by Name or ID"
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
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={openAddProfileModal}
            style="width: 156px; height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Plus size={20} slot="icon-left" />
            Add Profile
        </Button>
    </div>

    <div class="w-full device-profiles-page">
        <DataTable
            {columns}
            data={profiles}
            keyField="id"
            selectable={false}
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage="No profiles found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
        />
    </div>
</div>

<!-- Filter Modal -->
<Modal
    open={showFilterModal}
    title="Filter"
    size="md"
    showFooter={false}
    on:close={() => (showFilterModal = false)}
>
    <div class="flex flex-col gap-5 w-full min-w-0">
        <div class="flex flex-col gap-2 w-full min-w-0">
            <span class="text-sm font-medium text-[var(--ds-text-primary)]">Status</span>
            <Dropdown
                label=""
                placeholder="Select"
                options={statusDropdownOptions}
                value={filterStatuses}
                on:change={handleStatusFilterChange}
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

<!-- Add Profile modal -->
<AddEditProfileModal
    open={showAddProfileModal}
    mode="add"
    profileId={null}
    actionBasePath={$page.url.pathname}
    on:close={closeAddProfileModal}
    on:success={onAddProfileSuccess}
    on:error={(e) => onAddProfileError(e.detail)}
/>

<!-- Edit Profile modal -->
<AddEditProfileModal
    open={showEditProfileModal}
    mode="edit"
    profileId={editProfileRow?.id ?? null}
    actionBasePath={$page.url.pathname}
    on:close={closeEditProfileModal}
    on:success={onEditProfileSuccess}
    on:error={(e) => onEditProfileError(e.detail)}
/>

<!-- Delete confirmation modal (wording per design) -->
<Modal
    open={showDeleteModal}
    title="Delete Profile"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDeleteProfile}
>
    <p class="text-[var(--ds-text-secondary)]">
        Are you sure you want to delete this profile? Once you delete this profile, it can not be reverse.
    </p>
</Modal>

<style>
    /* TC-RDM-PR-0087: Prevent long name/description from overflowing table layout */
    :global(.device-profiles-page .ds-datatable td:has(.profile-name-cell)) {
        overflow: hidden;
    }
</style>
