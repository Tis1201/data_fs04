<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { toast } from '$lib/stores/alertToast';
    import { Button, InputField, DataTable, Modal } from '$lib/design-system/components';
    import type { SortState } from '$lib/design-system/components';
    import { Search, Plus } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { formatBytes } from '$lib/utils/format';
    import AddEditResourceModal from './components/AddEditResourceModal.svelte';

    export let data: PageData;
    export let params: Record<string, string> = {};

    interface ResourceRow {
        id: string;
        name: string;
        description: string | null;
        type: string;
        target: string | null;
        version: string | null;
        format: string | null;
        packageName: string | null;
        path: string | null;
        size: number;
        createdAt: Date | string;
        updatedAt: Date | string;
        accountId: string | null;
    }

    $: resources = (data.resources || []) as ResourceRow[];
    $: meta = data.meta || {};
    $: serverPagination = meta.pagination || {};
    $: serverSort = meta.sort || { field: 'createdAt', order: 'desc' };
    $: accounts = (data.accounts || []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }));

    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    let resourceToDelete: ResourceRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;

    let showAddResourceModal = false;
    let showEditResourceModal = false;
    let editResourceRow: ResourceRow | null = null;

    function openAddResourceModal() {
        showAddResourceModal = true;
    }

    function closeAddResourceModal() {
        showAddResourceModal = false;
    }

    function openEditResourceModal(row: ResourceRow) {
        editResourceRow = row;
        showEditResourceModal = true;
    }

    function closeEditResourceModal() {
        showEditResourceModal = false;
        editResourceRow = null;
    }

    function onAddResourceSuccess() {
        toast.success('Resource added successfully.');
        closeAddResourceModal();
        goto($page.url.pathname + $page.url.search, { invalidateAll: true });
    }

    function onEditResourceSuccess() {
        toast.success('Resource updated successfully.');
        closeEditResourceModal();
        goto($page.url.pathname + $page.url.search, { invalidateAll: true });
    }

    function onAddResourceError(message: string) {
        toast.error(message || 'Unable to add resource. Please try again!');
    }

    function onEditResourceError(message: string) {
        toast.error(message || 'Unable to update resource. Please try again!');
    }

    function triggerResourceDownload(url: string, filename: string) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'resource';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function openDeleteModal(row: ResourceRow) {
        resourceToDelete = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        resourceToDelete = null;
    }

    async function confirmDeleteResource() {
        if (!resourceToDelete) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', resourceToDelete.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Resource deleted successfully.');
                closeDeleteModal();
                await goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.message || 'Unable to delete resource. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to delete resource. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

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

    const basePath = '/user/resources';

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

    function typeDisplay(type: string): string {
        const m: Record<string, string> = {
            application: 'Application',
            file: 'File',
            image: 'Image',
            video: 'Video',
            document: 'Document',
            archive: 'Archive',
            package: 'Package'
        };
        return m[type?.toLowerCase()] ?? type ?? '—';
    }

    function targetDisplay(target: string | null | undefined): string {
        if (!target) return '—';
        const t = target.toLowerCase();
        if (t === 'user') return 'User';
        if (t === 'device') return 'Device';
        if (t === 'account') return 'Account';
        return target;
    }

    $: columns = [
        {
            id: 'name',
            header: 'Name',
            accessor: (row: ResourceRow) => row.name || '',
            supportingField: 'packageName',
            type: 'textWithSupporting' as const,
            sortable: true,
            width: '280px'
        },
        {
            id: 'type',
            header: 'Type',
            accessor: (row: ResourceRow) => typeDisplay(row.type),
            type: 'text' as const,
            sortable: true,
            width: '120px'
        },
        {
            id: 'target',
            header: 'Target',
            accessor: (row: ResourceRow) => targetDisplay(row.target),
            type: 'text' as const,
            sortable: true,
            width: '100px'
        },
        {
            id: 'version',
            header: 'Version',
            accessor: (row: ResourceRow) => row.version || '—',
            type: 'text' as const,
            sortable: true,
            width: '100px'
        },
        {
            id: 'format',
            header: 'Format',
            accessor: (row: ResourceRow) => (row.format || '').toUpperCase() || '—',
            type: 'text' as const,
            sortable: true,
            width: '80px'
        },
        {
            id: 'size',
            header: 'Size',
            accessor: (row: ResourceRow) => formatBytes(row.size ?? 0),
            type: 'text' as const,
            sortable: true,
            width: '100px'
        },
        {
            id: 'createdAt',
            header: 'Created On',
            accessor: (row: ResourceRow) => row.createdAt,
            type: 'datetime' as const,
            sortable: true,
            width: '180px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu' as const,
            width: '80px',
            getMenuActions: (row: ResourceRow) => [
                {
                    id: 'view',
                    label: 'View',
                    onClick: () => goto(`${basePath}/${row.id}`)
                },
                {
                    id: 'edit',
                    label: 'Edit',
                    onClick: () => openEditResourceModal(row)
                },
                {
                    id: 'download',
                    label: 'Download',
                    onClick: () => triggerResourceDownload(`/api/resources/${row.id}`, row.name || (row.path && row.path.split('/').pop()) || 'resource')
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    color: 'danger' as const,
                    onClick: () => openDeleteModal(row)
                }
            ]
        }
    ];
</script>

<div class="flex flex-col items-start w-full" style="padding: var(--ds-space-6); gap: var(--ds-space-4);">
    <div class="flex flex-row items-center w-full" style="gap: var(--ds-space-4); height: 48px;">
        <div style="width: 500px; height: 48px;">
            <InputField
                type="search"
                placeholder="Search by Name, Type or Package Name"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>
        <div style="flex: 1;"></div>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={openAddResourceModal}
            style="min-width: 156px; height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Plus size={20} slot="icon-left" />
            Add Resource
        </Button>
    </div>

    <div class="w-full">
        <DataTable
            {columns}
            data={resources}
            keyField="id"
            selectable={false}
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage="No resources found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
        />
    </div>
</div>

<!-- Add Resource modal -->
<AddEditResourceModal
    open={showAddResourceModal}
    mode="add"
    resourceId={null}
    initialData={null}
    accounts={accounts}
    on:close={closeAddResourceModal}
    on:success={onAddResourceSuccess}
    on:error={(e) => onAddResourceError(e.detail)}
/>

<!-- Edit Resource modal -->
<AddEditResourceModal
    open={showEditResourceModal}
    mode="edit"
    resourceId={editResourceRow?.id ?? null}
    initialData={editResourceRow ? {
        name: editResourceRow.name,
        packageName: editResourceRow.packageName ?? undefined,
        target: editResourceRow.target ?? undefined,
        version: editResourceRow.version ?? undefined,
        accountId: editResourceRow.accountId ?? undefined,
        path: editResourceRow.path ?? undefined,
        type: editResourceRow.type,
        format: editResourceRow.format ?? undefined,
        size: editResourceRow.size
    } : null}
    accounts={accounts}
    on:close={closeEditResourceModal}
    on:success={onEditResourceSuccess}
    on:error={(e) => onEditResourceError(e.detail)}
/>

<!-- Delete Resource modal (wording per Figma) -->
<Modal
    open={showDeleteModal}
    title="Delete Resource"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDeleteResource}
>
    <p class="text-[var(--ds-text-secondary)]">
        Are you sure you want to delete this resource? Once you delete this resource, it can not be reverse.
    </p>
</Modal>
