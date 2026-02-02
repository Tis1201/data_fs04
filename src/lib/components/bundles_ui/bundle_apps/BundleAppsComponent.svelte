<script lang="ts">
    import { toast } from '$lib/stores/alertToast';
    import { api_post, api_delete } from '$lib/utils/ApiUtils';
    import { invalidate } from '$app/navigation';
    import { Trash, Plus } from 'lucide-svelte';
    import { page } from "$app/stores";
    
    // Design System Components
    import { 
        DataTable, 
        Button, 
        Badge,
        Modal,
        BulkActionsBar,
        InputField
    } from '$lib/design-system/components';
    import type { ColumnDef, BadgeColor, ActionDef, BulkAction } from '$lib/design-system/components';
    
    import type { BundleApp } from "@prisma/client";
    import AppSelector from "$lib/components/bundles_ui/app_select/AppSelector.svelte";
    
    // Types
    type AppWithResource = BundleApp & {
        resource: { name: string; id: string; packageName?: string | null; version?: string | null; size?: number | null };
    };

    // Props
    export let bundleId: string;
    export let apps: AppWithResource[] = [];
    export let apiPrefix: string = '/api/admin';
    export let resourceLinkPrefix: string = '/admin/iot/resources';
    /** When true, header (count, search, Add App) is hidden; used when parent Card provides the header and Add App button. */
    export let hideHeader: boolean = false;
    /** When false, hide the Actions column (e.g. when Deployment = InProgress | Completed | Canceled) */
    export let showActionsColumn: boolean = true;
    
    // Local display copy for optimistic updates
    let displayApps: AppWithResource[] = apps;
    let lastAppsRef = apps;
    $: if (apps !== lastAppsRef) {
        displayApps = apps;
        lastAppsRef = apps;
    }
    
    // Search state
    let searchTerm = '';
    
    // Filter apps based on search
    $: filteredApps = displayApps.filter((a) => {
        if (!searchTerm) return true;
        return a.resource.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    // Selection state
    let selectedRows: AppWithResource[] = [];
    
    // State for add app dialog
    let addDialogOpen = false;
    let autoOpen = false;
    let addingApp = false;
    
    // State for delete confirmation modal
    let deleteModalOpen = false;
    let appToDelete: AppWithResource | null = null;
    let deleteLoading = false;
    
    // State for batch delete confirmation modal
    let batchDeleteModalOpen = false;
    let batchDeleteLoading = false;
    
    // Calculate the next order number based on existing apps
    $: installationOrder = apps.length > 0 
        ? Math.max(...apps.map(app => app.order)) + 1 
        : 1;
    
    // Check if bundle is editable (DRAFT status)
    $: isEditable = ($page?.data?.bundle?.status || '').toUpperCase() === 'DRAFT';
    
    // DataTable columns configuration (Figma: #, App, Type, Version, Size, Auto Open, Added On, Actions)
    const columns: ColumnDef<AppWithResource>[] = [
        {
            id: 'order',
            header: '#',
            accessor: 'order',
            type: 'custom',
            sortable: true,
            width: '50px',
            align: 'center',
            render: (value) => String(value != null ? value : '').padStart(2, '0')
        },
        {
            id: 'name',
            header: 'App',
            accessor: (row) => row.resource.name,
            type: 'custom',
            sortable: true,
            render: (value, row) => {
                const name = row.resource?.name ?? '—';
                const pkg = row.resource?.packageName ?? row.resource?.id ?? '';
                const link = `<a href="${resourceLinkPrefix}/${row.resource.id}" class="text-[14px] font-medium text-[var(--ds-text-link)] hover:text-[var(--ds-text-link-hover)] hover:underline">${escapeHtml(name)}</a>`;
                const pkgLine = pkg ? `<span class="text-[14px] font-normal leading-5 text-[var(--ds-text-tertiary)]">${escapeHtml(pkg)}</span>` : '';
                return `<div class="flex flex-col gap-0"><span>${link}</span>${pkgLine ? `<span>${pkgLine}</span>` : ''}</div>`;
            }
        },
        {
            id: 'type',
            header: 'Type',
            accessor: () => 'Normal',
            type: 'text',
            sortable: false,
            width: '100px'
        },
        {
            id: 'version',
            header: 'Version',
            accessor: (row) => row.resource?.version ?? '—',
            type: 'text',
            sortable: false,
            width: '100px'
        },
        {
            id: 'size',
            header: 'Size',
            accessor: (row) => row.resource?.size != null ? formatAppSize(row.resource.size) : '—',
            type: 'text',
            sortable: false,
            width: '100px'
        },
        {
            id: 'autoOpen',
            header: 'Auto Open',
            accessor: (row) => row.autoOpen ? 'Yes' : 'No',
            type: 'badge',
            sortable: true,
            statusColor: (value) => value === 'Yes' ? 'success' : 'gray',
            showDot: () => false,
            width: '100px'
        },
        {
            id: 'createdAt',
            header: 'Added On',
            accessor: 'createdAt',
            type: 'relativeTime',
            sortable: true,
            width: '150px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            align: 'right',
            getMenuActions: (row) => [
                {
                    id: 'remove',
                    label: 'Remove',
                    onClick: () => confirmDelete(row)
                }
            ]
        }
    ];

    $: displayColumns = showActionsColumn ? columns : columns.filter((c: ColumnDef<AppWithResource>) => c.id !== 'actions');

    function escapeHtml(s: string): string {
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }
    
    // Bulk actions configuration
    $: bulkActions = [
        {
            id: 'remove',
            label: 'Remove Selected',
            icon: Trash,
            destructive: true
        }
    ];
    
    // Function to open delete confirmation modal
    function confirmDelete(app: AppWithResource) {
        appToDelete = app;
        deleteModalOpen = true;
    }
    
    // Handle single delete confirmation
    async function handleDeleteConfirm() {
        if (!appToDelete) return;
        
        deleteLoading = true;
        const idToRemove = appToDelete.id;
        
        try {
            // Optimistic local update
            displayApps = displayApps.filter(a => a.id !== idToRemove);
            
            await api_delete(`${apiPrefix}/iot/bundles/${bundleId}/apps/${idToRemove}`, idToRemove);
            toast.success("App removed successfully!");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Unable to remove app. Please try again!");
            console.error(error);
            // Revert optimistic update on error
            displayApps = apps;
        } finally {
            deleteLoading = false;
            deleteModalOpen = false;
            appToDelete = null;
        }
    }
    
    // Handle batch delete
    function confirmBatchDelete() {
        if (selectedRows.length === 0) return;
        batchDeleteModalOpen = true;
    }
    
    async function handleBatchDeleteConfirm() {
        if (selectedRows.length === 0) return;
        
        batchDeleteLoading = true;
        const idsToRemove = selectedRows.map(r => r.id);
        
        try {
            // Optimistic local update
            displayApps = displayApps.filter(a => !idsToRemove.includes(a.id));
            
            const promises = idsToRemove.map((id) => 
                api_delete(`${apiPrefix}/iot/bundles/${bundleId}/apps/${id}`, id)
            );
            await Promise.all(promises);
            
            toast.success(`Removed ${idsToRemove.length} app(s)`);
            selectedRows = [];
            await invalidate('app:bundle');
        } catch (e) {
            console.error(e);
            toast.error('Failed to remove selected apps');
            // Revert optimistic update on error
            displayApps = apps;
        } finally {
            batchDeleteLoading = false;
            batchDeleteModalOpen = false;
        }
    }
    
    // Handle bulk action
    function handleBulkAction(event: CustomEvent<BulkAction>) {
        if (event.detail.id === 'remove') {
            confirmBatchDelete();
        }
    }
    
    // Handle app selection from AppSelector
    async function handleAppSelect(event: CustomEvent<{ id: string; name: string; autoOpen: boolean }[]>) {
        const selected = event.detail;
        if (!selected || selected.length === 0) return;
        
        addingApp = true;
        
        try {
            const promises = selected.map((res, idx) => api_post(`${apiPrefix}/iot/bundles/${bundleId}/apps`, {
                resourceId: res.id,
                order: installationOrder + idx,
                autoOpen: res.autoOpen
            }));
            await Promise.all(promises);
            
            toast.success(selected.length === 1 ? 'App added successfully!' : 'Apps added successfully!');
            
            // Optimistically append to displayApps
            displayApps = [
                ...displayApps,
                ...selected.map((res, idx) => ({
                    id: `temp-${res.id}-${Date.now()}-${idx}`,
                    bundleId,
                    resourceId: res.id,
                    order: installationOrder + idx,
                    autoOpen: res.autoOpen,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    createdBy: 'me',
                    updatedBy: 'me',
                    resource: { id: res.id, name: res.name }
                })) as AppWithResource[]
            ];
            
            await invalidate('app:bundle');
            addDialogOpen = false;
            autoOpen = false;
            
        } catch (error) {
            toast.error("Unable to add App. Please try again!");
            console.error(error);
        } finally {
            addingApp = false;
        }
    }
    
    // Handle selection change
    function handleSelectionChange(event: CustomEvent<AppWithResource[]>) {
        selectedRows = event.detail;
    }
    
    // Clear selection
    function clearSelection() {
        selectedRows = [];
    }

    /** Open the Add App dialog; call from parent when using hideHeader. */
    export function openAddDialog() {
        addDialogOpen = true;
    }

    function formatAppSize(bytes: number | null | undefined): string {
        if (bytes == null) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    }
</script>

<div class="apps-component">
    {#if !hideHeader}
        <!-- Header with count, search, and add button (when not using parent Card header) -->
        <div class="apps-header">
            <p class="apps-count">{filteredApps.length} app{filteredApps.length !== 1 ? 's' : ''} in this bundle</p>
            <div class="apps-actions">
                <div class="search-wrapper">
                    <InputField
                        type="search"
                        placeholder="Search apps..."
                        bind:value={searchTerm}
                    />
                </div>
                <Button
                    variant="filled"
                    color="primary"
                    size="md"
                    icon={Plus}
                    iconSize={18}
                    on:click={() => addDialogOpen = true}
                    disabled={!isEditable}
                    title={!isEditable ? 'Not editable: bundle already published' : undefined}
                >
                    Add App
                </Button>
            </div>
        </div>

        <!-- Bulk Actions Bar (only when header visible and selectable) -->
        {#if selectedRows.length > 0}
            <BulkActionsBar
                selectedCount={selectedRows.length}
                actions={bulkActions}
                on:action={handleBulkAction}
                on:clear={clearSelection}
            />
        {/if}
    {/if}

    <!-- Apps DataTable (Figma: #, App, Type, Version, Size, Auto Open, Added On, Actions; no checkbox when hideHeader) -->
    <DataTable
        data={filteredApps}
        columns={displayColumns}
        keyField="id"
        selectable={!hideHeader && isEditable && showActionsColumn}
        bind:selectedRows
        paginated={filteredApps.length > 10}
        hoverable={true}
        striped={false}
        bordered={false}
        cellBorders={false}
        emptyMessage="No apps added to this bundle yet"
        on:selectionChange={handleSelectionChange}
    />
</div>

<!-- App Selector Dialog -->
<AppSelector 
    bind:open={addDialogOpen}
    {bundleId}
    {apiPrefix}
    on:select={handleAppSelect}
    on:close={() => addDialogOpen = false}
    {autoOpen}
    on:autoOpenChange={(e) => autoOpen = e.detail}
/>

<!-- Delete Confirmation Modal -->
<Modal
    open={deleteModalOpen}
    title="Remove App"
    type="error"
    size="md"
    cancelText="Cancel"
    confirmText="Remove"
    confirmLoading={deleteLoading}
    on:close={() => { deleteModalOpen = false; appToDelete = null; }}
    on:confirm={handleDeleteConfirm}
>
    <p class="modal-text">
        Are you sure you want to remove this app? This action cannot be reversed.
    </p>
</Modal>

<!-- Batch Delete Confirmation Modal -->
<Modal
    open={batchDeleteModalOpen}
    title="Remove Selected Apps"
    type="error"
    size="sm"
    cancelText="Cancel"
    confirmText="Remove All"
    confirmLoading={batchDeleteLoading}
    on:close={() => batchDeleteModalOpen = false}
    on:confirm={handleBatchDeleteConfirm}
>
    <p class="modal-text">
        Are you sure you want to remove <strong>{selectedRows.length}</strong> selected app{selectedRows.length !== 1 ? 's' : ''} from the bundle? 
        This action cannot be undone.
    </p>
</Modal>

<style>
    .apps-component {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        font-family: var(--ds-font-family-primary);
    }
    
    .apps-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-4);
        flex-wrap: wrap;
    }
    
    .apps-count {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }
    
    .apps-actions {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
    }
    
    .search-wrapper {
        width: 240px;
    }
    
    .modal-text {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }
    
    .modal-text strong {
        color: var(--ds-text-primary);
    }
    
    @media (max-width: 640px) {
        .apps-header {
            flex-direction: column;
            align-items: stretch;
        }
        
        .apps-actions {
            flex-direction: column;
            align-items: stretch;
        }
        
        .search-wrapper {
            width: 100%;
        }
    }
</style>
