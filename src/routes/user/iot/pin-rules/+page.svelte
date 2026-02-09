<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { Button, InputField, DataTable, Modal, Dropdown } from '$lib/design-system/components';
    import type { BadgeColor, SortState } from '$lib/design-system/components';
    import { Search, Filter, Plus } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { toast } from '$lib/stores/alertToast';
    import PinRuleEditModal from '$lib/components/pin-rules/PinRuleEditModal.svelte';

    export let data: PageData;

    let ruleToDelete: PinRuleRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;
    let duplicateTarget: PinRuleRow | null = null;
    let showDuplicateModal = false;
    let duplicateLoading = false;
    let addModalOpen = false;

    interface PinRuleRow {
        id: string;
        name: string;
        ruleType: string;
        apps: string[];
        targetType: string;
        targetValue: string[];
        isActive: boolean;
        createdAt: Date | string;
        updatedAt: Date | string;
        account?: { id: string; name: string };
    }

    $: rules = (data.rules || []) as PinRuleRow[];
    $: meta = data.meta || {};
    $: serverPagination = meta.pagination || {};
    $: serverSort = meta.sort || { field: 'createdAt', order: 'desc' };

    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    // Filter modal
    let showFilterModal = false;
    const STATUS_OPTIONS = [
        { id: 'true', label: 'Active' },
        { id: 'false', label: 'Inactive' }
    ] as const;
    let filterStatuses: string[] = $page.url.searchParams.get('isActive')?.split(',').filter(Boolean) || [];

    $: statusDropdownOptions = [
        { id: '__all__', label: 'All', type: 'checkbox' as const },
        ...STATUS_OPTIONS.map((o) => ({ id: o.id, label: o.label, type: 'checkbox' as const }))
    ];

    function applyFilter() {
        const url = new URL($page.url);
        const statuses = filterStatuses.filter((s) => s !== '__all__');
        if (statuses.length) url.searchParams.set('isActive', statuses.join(','));
        else url.searchParams.delete('isActive');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
        showFilterModal = false;
    }

    function clearFilter() {
        filterStatuses = [];
        const url = new URL($page.url);
        url.searchParams.delete('isActive');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
        showFilterModal = false;
    }

    function openFilterModal() {
        filterStatuses = $page.url.searchParams.get('isActive')?.split(',').filter(Boolean) || [];
        showFilterModal = true;
    }

    // Debounced search
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
            goto(url.pathname + url.search, { noScroll: true });
        }, 500);
    }

    $: pagination = {
        page: serverPagination.page ?? 1,
        pageSize: serverPagination.per_page ?? 10,
        totalItems: serverPagination.total_records ?? 0,
        totalPages: serverPagination.total_pages ?? 0
    };

    $: sort = {
        field: serverSort.field || 'createdAt',
        direction: (serverSort.order as 'asc' | 'desc') || 'desc'
    };

    const basePath = '/user/iot';

    function escapeHtml(s: string): string {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function appliedToLabel(row: PinRuleRow): string {
        if (row.targetType === 'all') return 'All Devices';
        const count = row.targetValue?.length ?? 0;
        if (row.targetType === 'tags') return count === 0 ? 'All Tags' : `Selected Tags (${count})`;
        return count === 0 ? 'Selected Devices' : `Selected Devices (${count})`;
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
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    function statusColor(_value: string, row: PinRuleRow): BadgeColor {
        return row.isActive ? 'success' : 'gray';
    }

    function openDeleteModal(row: PinRuleRow) {
        ruleToDelete = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        ruleToDelete = null;
    }

    async function confirmDeleteRule() {
        if (!ruleToDelete) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', ruleToDelete.id);
            const res = await fetch('?/deletePinRule', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'failure') {
                toast.error(result.data?.error || 'Unable to delete rule. Please try again!');
                return;
            }
            toast.success('Rule deleted successfully.');
            closeDeleteModal();
            await invalidate('app:pin-rules');
            goto($page.url.pathname + $page.url.search, { noScroll: true });
        } catch (err) {
            toast.error('Unable to delete rule. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    function openDuplicateModal(row: PinRuleRow) {
        duplicateTarget = row;
        showDuplicateModal = true;
    }

    function closeDuplicateModal() {
        showDuplicateModal = false;
        duplicateTarget = null;
    }

    async function confirmDuplicate() {
        if (!duplicateTarget) return;
        duplicateLoading = true;
        try {
            const res = await fetch(`/api/v2/pin-rules/${duplicateTarget.id}/duplicate`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data?.error?.message || 'Unable to duplicate rule. Please try again!');
                return;
            }
            toast.success('Rule duplicated successfully.');
            closeDuplicateModal();
            await invalidate('app:pin-rules');
            goto($page.url.pathname + $page.url.search, { noScroll: true });
        } catch (err) {
            toast.error('Unable to duplicate rule. Please try again!');
        } finally {
            duplicateLoading = false;
        }
    }

    $: columns = [
        {
            id: 'name',
            header: 'Name',
            accessor: (row: PinRuleRow) => row.name || '',
            type: 'custom' as const,
            sortable: true,
            width: '280px',
            render: (_value: unknown, row: PinRuleRow) => {
                const name = row.name || '—';
                const link = `<a href="${basePath}/pin-rules/${row.id}" class="text-[14px] font-medium text-[var(--ds-text-link)] hover:text-[var(--ds-text-link-hover)] hover:underline">${escapeHtml(name)}</a>`;
                const idLine = `<span class="text-[14px] font-normal leading-5 text-[var(--ds-text-tertiary)]">${escapeHtml(row.id)}</span>`;
                return `<div class="flex flex-col gap-0"><span>${link}</span><span>${idLine}</span></div>`;
            }
        },
        {
            id: 'pinnedApps',
            header: 'Pinned Apps',
            accessor: (row: PinRuleRow) => row.apps?.length ?? 0,
            type: 'number' as const,
            width: '120px',
            render: (_value: unknown, row: PinRuleRow) => {
                const n = row.apps?.length ?? 0;
                return `${n} Pinned App${n !== 1 ? 's' : ''}`;
            }
        },
        {
            id: 'appliedTo',
            header: 'Applied to',
            accessor: (row: PinRuleRow) => appliedToLabel(row),
            type: 'text' as const,
            width: '160px'
        },
        {
            id: 'updatedAt',
            header: 'Last Updated On',
            accessor: (row: PinRuleRow) => row.updatedAt ?? row.createdAt,
            type: 'datetime' as const,
            sortable: true,
            width: '180px'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row: PinRuleRow) => (row.isActive ? 'Active' : 'Inactive'),
            type: 'badge' as const,
            sortable: true,
            statusColor,
            showDot: () => true,
            width: '120px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu' as const,
            width: '80px',
            getMenuActions: (row: PinRuleRow) => {
                const actions: { id: string; label: string; color?: 'danger'; onClick?: () => void }[] = [
                    {
                        id: 'view',
                        label: 'View',
                        onClick: () => goto(`${basePath}/pin-rules/${row.id}`)
                    },
                    {
                        id: 'edit',
                        label: 'Edit',
                        onClick: () => goto(`${basePath}/pin-rules/${row.id}/edit`)
                    },
                    {
                        id: 'duplicate',
                        label: 'Duplicate',
                        onClick: () => openDuplicateModal(row)
                    },
                    ...(row.ruleType !== 'user_default'
                        ? [{ id: 'delete', label: 'Delete', color: 'danger' as const, onClick: () => openDeleteModal(row) }]
                        : [])
                ];
                return actions;
            }
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
            on:click={() => (addModalOpen = true)}
            style="width: 156px; height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Plus size={20} slot="icon-left" />
            Add Rule
        </Button>
    </div>

    <div class="w-full">
        <DataTable
            {columns}
            data={rules}
            keyField="id"
            selectable={false}
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage="No pin rules found"
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
                bind:value={filterStatuses}
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

<!-- Duplicate confirmation modal (same pattern as bulk deployment) -->
<Modal
    open={showDuplicateModal}
    title="Duplicate Rule"
    size="md"
    cancelText="Cancel"
    confirmText="Duplicate"
    confirmLoading={duplicateLoading}
    confirmDisabled={duplicateLoading}
    on:close={closeDuplicateModal}
    on:confirm={confirmDuplicate}
>
    <p class="text-[var(--ds-text-secondary)]">
        Do you want to proceed with the duplicate? The new rule will use the same name with " (Copy)" and the same apps and target settings. It will be created as inactive.
    </p>
</Modal>

<!-- Delete confirmation modal -->
<Modal
    open={showDeleteModal}
    title="Delete Rule"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDeleteRule}
>
    <p class="text-[var(--ds-text-secondary)]">
        Are you sure you want to delete this rule? This action cannot be undone.
    </p>
</Modal>

<!-- Add/Create Rule modal -->
<PinRuleEditModal
    bind:open={addModalOpen}
    rule={null}
    apiPrefix="/api/v2"
    onSaved={async () => {
        await invalidate('app:pin-rules');
        addModalOpen = false;
    }}
    on:saved={async () => {
        await invalidate('app:pin-rules');
    }}
/>
