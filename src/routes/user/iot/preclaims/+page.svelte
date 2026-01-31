<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { toast } from '$lib/stores/alertToast';
    import { Button, InputField, DataTable, Modal } from '$lib/design-system/components';
    import type { SortState } from '$lib/design-system/components';
    import { Search, Plus } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { formatTableDateTime } from '$lib/utils/format';
    import AddEditPreclaimModal from './components/AddEditPreclaimModal.svelte';

    export let data: PageData;

    interface PreclaimRow {
        id: string;
        name: string;
        description: string | null;
        status: string;
        expiresAt: Date | string | null;
        createdAt: Date | string;
        profileId?: string | null;
        accountId?: string | null;
        account?: { id: string; name: string };
        _count?: { claims: number };
    }

    $: preclaimSets = (data.preclaimSets || []) as PreclaimRow[];
    $: meta = data.meta || {};
    $: serverPagination = meta.pagination || {};
    $: serverSort = meta.sort || { field: 'createdAt', order: 'desc' };
    $: profileOptions = (data.profileOptions || []).map((p: { id: string; label: string }) => ({ id: p.id, label: p.label }));
    $: accountOptions = (data.accountOptions || []).map((a: { id: string; label: string }) => ({ id: a.id, label: a.label }));

    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    let showAddModal = false;
    let showEditModal = false;
    let editRow: PreclaimRow | null = null;
    let preclaimToDelete: PreclaimRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;

    function openAddModal() {
        showAddModal = true;
    }

    function closeAddModal() {
        showAddModal = false;
    }

    function openEditModal(row: PreclaimRow) {
        editRow = row;
        showEditModal = true;
    }

    function closeEditModal() {
        showEditModal = false;
        editRow = null;
    }

    function onAddSuccess() {
        toast.success('Pre-Enrollment Set added successfully!');
        closeAddModal();
        goto($page.url.pathname + $page.url.search, { invalidateAll: true });
    }

    function onEditSuccess() {
        toast.success('Pre-Enrollment Set updated successfully!');
        closeEditModal();
        goto($page.url.pathname + $page.url.search, { invalidateAll: true });
    }

    function onAddError(msg: string) {
        toast.error(msg || 'Unable to add Pre-Enrollment Set. Please try again!');
    }

    function onEditError(msg: string) {
        toast.error(msg || 'Unable to update Pre-Enrollment Set. Please try again!');
    }

    function openDeleteModal(row: PreclaimRow) {
        preclaimToDelete = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        preclaimToDelete = null;
    }

    async function confirmDelete() {
        if (!preclaimToDelete) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', preclaimToDelete.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Pre-enrollment deleted successfully.');
                closeDeleteModal();
                await goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.message || 'Unable to delete Pre-enrollment. Please try again!');
            }
        } catch {
            toast.error('Unable to delete Pre-enrollment. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Debounced search
    $: if (browser && typeof searchValue !== 'undefined') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const current = $page.url.searchParams.get('search') || '';
            const next = searchValue.trim();
            if (next === current) return;
            const url = new URL($page.url);
            if (next) url.searchParams.set('search', next);
            else url.searchParams.delete('search');
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

    const basePath = '/user/iot/preclaims';

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

    function formatValidUntil(value: Date | string | null | undefined): string {
        if (value == null || value === '') return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }

    /** Pre-Enrollment status display: Draft (grey), In Progress (orange), Completed (green) */
    function statusDisplay(row: PreclaimRow): string {
        const s = (row.status || '').toUpperCase();
        if (s === 'INACTIVE') return 'Draft';
        if (s === 'ACTIVE') {
            const exp = row.expiresAt ? new Date(row.expiresAt) : null;
            const now = new Date();
            if (exp != null && exp <= now) return 'Completed';
            return 'In Progress';
        }
        return row.status || '—';
    }

    function statusColor(_value: string, row: PreclaimRow): 'success' | 'gray' | 'warning' {
        const s = (row.status || '').toUpperCase();
        if (s === 'INACTIVE') return 'gray'; // Draft
        if (s === 'ACTIVE') {
            const exp = row.expiresAt ? new Date(row.expiresAt) : null;
            const now = new Date();
            if (exp != null && exp <= now) return 'success'; // Completed
            return 'warning'; // In Progress (orange)
        }
        return 'gray';
    }

    /** Draft: View, Edit, Delete. In Progress / Completed: View only. */
    function getActionsForRow(row: PreclaimRow) {
        const s = (row.status || '').toUpperCase();
        const isDraft = s === 'INACTIVE';
        const actions: { id: string; label: string; onClick: () => void; color?: 'danger' }[] = [
            { id: 'view', label: 'View', onClick: () => goto(`${basePath}/${row.id}`) }
        ];
        if (isDraft) {
            actions.push(
                { id: 'edit', label: 'Edit', onClick: () => openEditModal(row) },
                { id: 'delete', label: 'Delete', color: 'danger', onClick: () => openDeleteModal(row) }
            );
        }
        return actions;
    }

    $: columns = [
        {
            id: 'name',
            header: 'Name',
            accessor: (row: PreclaimRow) => row.name || '',
            supportingField: 'description',
            type: 'textWithSupporting' as const,
            sortable: true,
            width: '280px'
        },
        {
            id: 'expiresAt',
            header: 'Valid Until',
            accessor: (row: PreclaimRow) => formatValidUntil(row.expiresAt),
            type: 'text' as const,
            sortable: true,
            width: '120px'
        },
        {
            id: 'createdAt',
            header: 'Created On',
            accessor: (row: PreclaimRow) => row.createdAt,
            type: 'datetime' as const,
            sortable: true,
            width: '180px'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row: PreclaimRow) => statusDisplay(row),
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
            getMenuActions: (row: PreclaimRow) => getActionsForRow(row)
        }
    ];
</script>

<div class="flex flex-col items-start w-full preclaim-list-page">
    <div class="flex flex-row items-center w-full list-toolbar">
        <div class="search-wrap">
            <InputField
                type="search"
                placeholder="Search by Name or ID"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>
        <div class="flex-1"></div>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={openAddModal}
            style="min-width: 100px; height: 44px; background: var(--ds-color-primary-600); border: 1px solid var(--ds-color-primary-600); box-shadow: 0 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Plus size={20} slot="icon-left" />
            Add Set
        </Button>
    </div>

    <div class="w-full table-wrap">
        <DataTable
            {columns}
            data={preclaimSets}
            keyField="id"
            selectable={false}
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage="No pre-enrollment sets found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
        />
    </div>
</div>

<AddEditPreclaimModal
    open={showAddModal}
    mode="add"
    preclaimId={null}
    initialData={null}
    profileOptions={profileOptions}
    accountOptions={accountOptions}
    on:close={closeAddModal}
    on:success={onAddSuccess}
    on:error={(e) => onAddError(e.detail)}
/>

<AddEditPreclaimModal
    open={showEditModal}
    mode="edit"
    preclaimId={editRow?.id ?? null}
    initialData={editRow ? {
        name: editRow.name,
        description: editRow.description ?? undefined,
        status: editRow.status,
        expiresAt: editRow.expiresAt ? new Date(editRow.expiresAt).toISOString().slice(0, 10) : undefined,
        accountId: editRow.accountId ?? editRow.account?.id ?? undefined,
        profileId: editRow.profileId ?? undefined
    } : null}
    profileOptions={profileOptions}
    accountOptions={accountOptions}
    on:close={closeEditModal}
    on:success={onEditSuccess}
    on:error={(e) => onEditError(e.detail)}
/>

<Modal
    open={showDeleteModal}
    title="Delete Pre-Enrollment"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDelete}
>
    <p class="delete-confirm-text">
        Are you sure you want to delete this pre-enrollment? Once you delete this pre-enrollment, it can not be reverse.
    </p>
</Modal>

<style>
    .preclaim-list-page {
        padding: var(--ds-space-6);
        gap: var(--ds-space-4);
    }
    .list-toolbar {
        gap: var(--ds-space-4);
        height: 48px;
    }
    .search-wrap {
        width: 500px;
        height: 48px;
    }
    .table-wrap {
        min-width: 0;
    }
    .delete-confirm-text {
        color: var(--ds-text-secondary);
    }
</style>
