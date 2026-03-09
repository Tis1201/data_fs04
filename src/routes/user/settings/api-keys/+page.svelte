<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import {
        Button,
        InputField,
        DataTable,
        Modal,
        Dropdown,
        ConfirmModal,
        TabGroup
    } from '$lib/design-system/components';
    import type { SortState, ColumnDef, PaginationState } from '$lib/design-system/components';
    import { Search, Plus, SquareMousePointer, Copy } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { toast } from '$lib/stores/alertToast';

    // API Key row type
    interface ApiKeyRow {
        id: string;
        name: string;
        key: string;
        fullKey: string;
        permission: string;
        createdOn: string;
        lastUsedOn: string | null;
        active: boolean;
    }

    // Permission options
    const API_KEY_PERMISSIONS = [
        { id: 'read', label: 'Read' },
        { id: 'write', label: 'Write' },
        { id: 'read_write', label: 'Read & Write' }
    ] as const;
    import { invalidate } from '$app/navigation';

    export let data: PageData;

    $: apiKeys = (data.apiKeys || []) as ApiKeyRow[];
    $: meta = data.meta || {};
    $: serverPagination = meta.pagination || {};
    $: serverSort = meta.sort || { field: 'createdOn', order: 'desc' };

    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    // Add API Key modal
    let showAddModal = false;
    let addLoading = false;
    let newKeyName = '';
    let newKeyPermission = '';

    // Delete API Key modal
    let deleteTarget: ApiKeyRow | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;

    // Regenerate API Key modal
    let regenerateTarget: ApiKeyRow | null = null;
    let showRegenerateModal = false;
    let regenerateLoading = false;

    // Usage Example modal
    let showUsageModal = false;
    let usageActiveTab = 'curl';

    // Newly created API key (shown once after creation/regeneration)
    let newlyCreatedKey: string | null = null;
    let showNewKeyModal = false;

    let pagination: PaginationState = { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 };
    $: pagination = {
        page: serverPagination.page ?? 1,
        pageSize: serverPagination.per_page ?? 10,
        totalItems: serverPagination.total_records ?? 0,
        totalPages: serverPagination.total_pages ?? 0
    };

    let sort: SortState = { field: 'createdOn', direction: 'desc' };
    $: sort = {
        field: serverSort?.field === null ? null : (serverSort?.field || 'createdOn'),
        direction:
            serverSort?.order === null ? null : ((serverSort?.order as 'asc' | 'desc') || 'desc')
    };

    const permissionOptions = API_KEY_PERMISSIONS.map(p => ({ id: p.id, label: p.label }));

    function handleSort(event: CustomEvent<SortState>) {
        const next = event.detail;
        const url = new URL($page.url);
        if (next.field && next.direction) {
            url.searchParams.set('sort', next.field);
            url.searchParams.set('order', next.direction);
            url.searchParams.delete('sort_default');
        } else {
            url.searchParams.delete('sort');
            url.searchParams.delete('order');
            url.searchParams.set('sort_default', '1'); // Explicit unsort: show dual arrows on all columns
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
    }

    // Debounced search
    $: if (browser && typeof searchValue !== 'undefined') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const currentSearch = $page.url.searchParams.get('search') || '';
            const newSearch = searchValue.trim();
            if (newSearch === currentSearch) return;
            const url = new URL($page.url);
            if (newSearch) url.searchParams.set('search', newSearch);
            else url.searchParams.delete('search');
            url.searchParams.set('page', '1');
            goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
        }, 500);
    }

    // Format date for display
    function formatDate(isoStr: string | null): string {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(',', '');
    }

    // Copy API key to clipboard
    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            toast.success('API key copied to clipboard');
        } catch {
            toast.error('Failed to copy to clipboard');
        }
    }

    // Add API Key handlers
    function openAddModal() {
        newKeyName = '';
        newKeyPermission = '';
        showAddModal = true;
    }

    function closeAddModal() {
        showAddModal = false;
        newKeyName = '';
        newKeyPermission = '';
    }

    async function handleAddApiKey() {
        if (!newKeyName.trim()) {
            toast.error('Key name is required');
            return;
        }
        if (!newKeyPermission) {
            toast.error('Permission is required');
            return;
        }

        addLoading = true;
        try {
            const fd = new FormData();
            fd.set('name', newKeyName.trim());
            fd.set('permission', newKeyPermission);
            const res = await fetch('?/create', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result?.type === 'failure' || result?.success === false) {
                toast.error(result?.data?.error || result?.error || 'Unable to add API Key. Please try again!');
                return;
            }

            // Show the new key in a modal
            if (result?.data?.apiKey) {
                newlyCreatedKey = result.data.apiKey;
                showNewKeyModal = true;
            }

            toast.success('API Key added successfully!');
            closeAddModal();
            await invalidate('app:userApiKeys');
        } catch {
            toast.error('Unable to add API Key. Please try again!');
        } finally {
            addLoading = false;
        }
    }

    // Delete API Key handlers
    function openDeleteModal(row: ApiKeyRow) {
        deleteTarget = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        deleteTarget = null;
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', deleteTarget.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result?.type === 'failure' || result?.success === false) {
                toast.error(result?.data?.error || result?.error || 'Unable to delete API Key. Please try again!');
                return;
            }

            toast.success('API Key deleted successfully!');
            closeDeleteModal();
            await invalidate('app:userApiKeys');
        } catch {
            toast.error('Unable to delete API Key. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Regenerate API Key handlers
    function openRegenerateModal(row: ApiKeyRow) {
        regenerateTarget = row;
        showRegenerateModal = true;
    }

    function closeRegenerateModal() {
        showRegenerateModal = false;
        regenerateTarget = null;
    }

    async function confirmRegenerate() {
        if (!regenerateTarget) return;
        regenerateLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', regenerateTarget.id);
            const res = await fetch('?/regenerate', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result?.type === 'failure' || result?.success === false) {
                toast.error(result?.data?.error || result?.error || 'Unable to regenerate API Key. Please try again!');
                return;
            }

            // Show the new key in a modal
            if (result?.data?.apiKey) {
                newlyCreatedKey = result.data.apiKey;
                showNewKeyModal = true;
            }

            toast.success('API Key regenerated successfully!');
            closeRegenerateModal();
            await invalidate('app:userApiKeys');
        } catch {
            toast.error('Unable to regenerate API Key. Please try again!');
        } finally {
            regenerateLoading = false;
        }
    }

    // Usage Example handlers
    function openUsageModal() {
        usageActiveTab = 'curl';
        showUsageModal = true;
    }

    function closeUsageModal() {
        showUsageModal = false;
    }

    function handleUsageTabChange(e: CustomEvent<string>) {
        usageActiveTab = e.detail;
    }

    const USAGE_TABS = [
        { id: 'curl', label: 'cURL' },
        { id: 'python', label: 'Python' },
        { id: 'javascript', label: 'JavaScript' }
    ];

    const curlCode = `curl -X GET "https://api.radarsensor.com/v2/sensors" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;

    const pythonCode = `import requests

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

response = requests.get(
    "https://api.radarsensor.com/v2/sensors",
    headers=headers
)

print(response.json())`;

    const javascriptCode = `const response = await fetch(
    "https://api.radarsensor.com/v2/sensors",
    {
        headers: {
            "Authorization": "Bearer YOUR_API_KEY",
            "Content-Type": "application/json"
        }
    }
);

const data = await response.json();
console.log(data);`;

    function getCurrentCode(): string {
        if (usageActiveTab === 'curl') return curlCode;
        if (usageActiveTab === 'python') return pythonCode;
        return javascriptCode;
    }

    // Table columns
    const columns: ColumnDef<ApiKeyRow>[] = [
        {
            id: 'name',
            header: 'Name',
            accessor: (row) => row.name,
            type: 'custom',
            sortable: true,
            width: '20%',
            render: (_value, row) => {
                const name = row.name || '—';
                const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                const link = `<span class="text-[14px] font-medium text-[var(--ds-text-primary)]">${esc(name)}</span>`;
                const idLine = row.id ? `<div style="font-family: var(--ds-font-family-primary); font-size: 12px; color: var(--ds-color-gray-500); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;" title="${esc(row.id)}">${esc(row.id)}</div>` : '';
                return `<div class="flex flex-col gap-0 min-w-0"><span class="min-w-0">${link}</span>${idLine}</div>`;
            }
        },
        {
            id: 'key',
            header: 'API Key',
            type: 'custom',
            width: '20%',
            render: (_value, row) => {
                return `<div class="api-key-cell">
                    <span class="api-key-value">${row.key}</span>
                    <button class="copy-btn" data-key-id="${row.id}" title="Copy API Key">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                        </svg>
                    </button>
                </div>`;
            }
        },
        {
            id: 'permission',
            header: 'Permission',
            accessor: (row) => row.permission || '—',
            type: 'text',
            width: '12%'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row) => (row.active ? 'Active' : 'Inactive'),
            type: 'badge',
            statusColor: (_value, row) => (row.active ? 'success' : 'error'),
            showDot: () => true,
            width: '10%'
        },
        {
            id: 'createdOn',
            header: 'Created On',
            accessor: (row) => formatDate(row.createdOn),
            type: 'text',
            sortable: true,
            width: '19%'
        },
        {
            id: 'lastUsedOn',
            header: 'Last Used On',
            accessor: (row) => formatDate(row.lastUsedOn),
            type: 'text',
            sortable: true,
            width: '19%'
        },
        {
            id: 'actions',
            header: 'Action',
            type: 'moreMenu',
            width: '8%',
            align: 'center',
            getMenuActions: (row) => [
                {
                    id: 'regenerate',
                    label: 'Regenerate',
                    onClick: () => openRegenerateModal(row)
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    destructive: true,
                    onClick: () => openDeleteModal(row)
                }
            ]
        }
    ];

    // Handle copy button clicks in table
    function handleTableClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const copyBtn = target.closest('.copy-btn') as HTMLButtonElement;
        if (copyBtn) {
            const keyId = copyBtn.dataset.keyId;
            const row = apiKeys.find(k => k.id === keyId);
            if (row) {
                // Copy full API key (not masked)
                copyToClipboard(row.fullKey);
            }
        }
    }
</script>

<svelte:head>
    <title>API Keys - Data Realities</title>
</svelte:head>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="api-keys-page flex flex-col" style="padding: 24px; gap: 16px;" on:click={handleTableClick}>
    <!-- Search & Action bar -->
    <div class="flex flex-row items-center" style="gap: 16px; height: 48px; width: 100%;">
        <div class="search-input-wrapper">
            <InputField
                type="search"
                placeholder="Search by API name"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>
        <div class="action-buttons">
            <Button
                variant="outline"
                color="gray"
                size="lg"
                icon={SquareMousePointer}
                iconPosition="left"
                on:click={openUsageModal}
            >
                Usage Example
            </Button>
            <Button
                variant="filled"
                color="primary"
                size="lg"
                icon={Plus}
                iconPosition="left"
                on:click={openAddModal}
            >
                Add API Key
            </Button>
        </div>
    </div>

    <!-- Data Table -->
    <div class="w-full">
        <DataTable
            {columns}
            data={apiKeys}
            keyField="id"
            selectable={false}
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage="No API keys found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
        />
    </div>
</div>

<!-- Add API Key Modal -->
<Modal
    open={showAddModal}
    title="Add API Key"
    size="sm"
    on:close={closeAddModal}
>
    <div class="add-modal-body">
        <InputField
            type="text"
            label="Key Name"
            placeholder="Enter"
            bind:value={newKeyName}
            required={true}
        />
        <div class="permission-field">
            <Dropdown
                label="Permission"
                placeholder="Select"
                options={permissionOptions}
                bind:value={newKeyPermission}
                required={true}
            />
        </div>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="outline" color="primary" size="lg" on:click={closeAddModal}>
            Cancel
        </Button>
        <Button 
            variant="filled" 
            color="primary" 
            size="lg" 
            on:click={handleAddApiKey}
            disabled={addLoading}
        >
            {addLoading ? 'Adding...' : 'Add'}
        </Button>
    </svelte:fragment>
</Modal>

<!-- Delete API Key Confirm Modal -->
<ConfirmModal
    open={showDeleteModal}
    title="Delete API Key"
    description="Are you sure you want to delete this API key? This action can not be reverse."
    cancelText="Cancel"
    confirmText="Delete"
    type="error"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDelete}
/>

<!-- Regenerate API Key Confirm Modal -->
<ConfirmModal
    open={showRegenerateModal}
    title="Regenerate API Key"
    description="Are you sure you want to delete this API key? Regenerating this key will invalidate the current key and may interrupt connected services."
    cancelText="Cancel"
    confirmText="Regenerate"
    type="warning"
    confirmLoading={regenerateLoading}
    confirmDisabled={regenerateLoading}
    on:close={closeRegenerateModal}
    on:confirm={confirmRegenerate}
/>

<!-- New API Key Display Modal -->
<Modal
    open={showNewKeyModal}
    title="API Key Created"
    size="sm"
    on:close={() => { showNewKeyModal = false; newlyCreatedKey = null; }}
>
    <div class="new-key-body">
        <p class="new-key-warning">
            Please copy your API key now. You won't be able to see it again!
        </p>
        <div class="new-key-display">
            <code class="new-key-value">{newlyCreatedKey}</code>
            <button class="new-key-copy" on:click={() => newlyCreatedKey && copyToClipboard(newlyCreatedKey)}>
                <Copy size={18} />
            </button>
        </div>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="filled" color="primary" size="lg" on:click={() => { showNewKeyModal = false; newlyCreatedKey = null; }}>
            Done
        </Button>
    </svelte:fragment>
</Modal>

<!-- Usage Example Modal -->
<Modal
    open={showUsageModal}
    title="Usage Example"
    size="md"
    on:close={closeUsageModal}
>
    <div class="usage-modal-body">
        <TabGroup
            tabs={USAGE_TABS}
            activeTab={usageActiveTab}
            type="underline"
            size="sm"
            on:change={handleUsageTabChange}
        />
        <div class="usage-content-wrap">
            <div class="usage-header">
                <p class="usage-description">Sample code to authenticate with your API key</p>
                <button class="usage-copy-btn" on:click={() => copyToClipboard(getCurrentCode())}>
                    <Copy size={16} />
                </button>
            </div>
            <pre class="usage-code">{getCurrentCode()}</pre>
        </div>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="filled" color="primary" size="lg" on:click={closeUsageModal}>
            Close
        </Button>
    </svelte:fragment>
</Modal>

<style>
    .api-keys-page {
        width: 100%;
        background: var(--ds-bg-secondary);
        min-height: 100%;
    }

    .search-input-wrapper {
        width: 500px;
        height: 48px;
        flex-shrink: 0;
    }

    .action-buttons {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        margin-left: auto;
    }

    /* API Key cell with copy button */
    :global(.api-key-cell) {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    :global(.api-key-value) {
        font-family: 'B612 Mono', monospace;
        font-size: 14px;
        color: var(--ds-text-primary);
    }

    :global(.copy-btn) {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--ds-color-neutral-true-500);
        transition: color 0.15s ease;
    }

    :global(.copy-btn:hover) {
        color: var(--ds-color-neutral-true-700);
    }

    /* Add Modal */
    .add-modal-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .permission-field {
        width: 100%;
    }

    /* New Key Modal */
    .new-key-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .new-key-warning {
        font: var(--ds-text-sm-regular);
        color: var(--ds-color-warning-600);
    }

    .new-key-display {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-3);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-md);
        border: 1px solid var(--ds-border-default);
    }

    .new-key-value {
        flex: 1;
        font-family: 'B612 Mono', monospace;
        font-size: 13px;
        color: var(--ds-text-primary);
        word-break: break-all;
    }

    .new-key-copy {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--ds-color-neutral-true-500);
        transition: color 0.15s ease;
    }

    .new-key-copy:hover {
        color: var(--ds-color-neutral-true-700);
    }

    /* Usage Modal */
    .usage-modal-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .usage-content-wrap {
        display: flex;
        flex-direction: column;
        background: #FAFAFA;
        border-radius: var(--ds-radius-lg);
        padding: var(--ds-space-4);
    }

    .usage-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--ds-space-3);
    }

    .usage-description {
        font: var(--ds-text-sm-medium);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .usage-copy-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--ds-color-neutral-true-500);
        transition: color 0.15s ease;
    }

    .usage-copy-btn:hover {
        color: var(--ds-color-neutral-true-700);
    }

    .usage-code {
        font-family: 'B612 Mono', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: var(--ds-text-primary);
        white-space: pre-wrap;
        word-break: break-all;
        margin: 0;
    }
</style>
