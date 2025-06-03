<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Pencil, Trash, ArrowUpDown } from "lucide-svelte";
    import type { BundleApp } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_delete } from "$lib/utils/ApiUtils";
    import { invalidate } from '$app/navigation';

    // Props for DataTable component
    export let props = {
        records: [] as (BundleApp & { resource: { name: string, id: string } })[],
        bundleId: '',
        loading: false
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as (BundleApp & { resource: { name: string, id: string } }) | null,
        confirmationOpen: false,
        title: "Remove App",
        message: "Are you sure you want to remove this app from the bundle? This action cannot be undone.",
        confirmButtonText: "Remove",
        cancelButtonText: "Cancel"
    };

    // Function to open delete confirmation dialog
    function confirmDelete(bundleApp: BundleApp & { resource: { name: string, id: string } }) {
        state.selectedRecord = bundleApp;
        state.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    async function handleDeleteConfirm() {
        if (!state.selectedRecord) return;
        
        try {
            await api_delete(`/api/admin/iot/bundles/${props.bundleId}/apps/${state.selectedRecord.id}`);
            toast.success("App removed from bundle successfully");
            await invalidate('app:bundle');
        } catch (error) {
            toast.error("Failed to remove app from bundle");
            console.error(error);
        } finally {
            state.confirmationOpen = false;
            state.selectedRecord = null;
        }
    }
    
    // Table columns definition
    const columns = [
        {
            id: "order",
            label: "Order",
            sortable: false,
            render: (bundleApp: BundleApp & { resource: { name: string, id: string } }) => bundleApp.order
        },
        {
            id: "resource",
            label: "App",
            sortable: false,
            render: (bundleApp: BundleApp & { resource: { name: string, id: string } }) => bundleApp.resource.name
        },
        {
            id: "autoOpen",
            label: "Auto Open",
            sortable: false,
            render: (bundleApp: BundleApp & { resource: { name: string, id: string } }) => bundleApp.autoOpen ? 'Yes' : 'No'
        },
        {
            id: "createdAt",
            label: "Added",
            sortable: false,
            render: (bundleApp: BundleApp & { resource: { name: string, id: string } }) => {
                return {
                    component: RelativeDate,
                    props: {
                        date: bundleApp.createdAt
                    }
                };
            }
        },
        {
            id: "actions",
            label: "",
            sortable: false,
            render: (bundleApp: BundleApp & { resource: { name: string, id: string } }) => {
                const actions: ActionItem[] = [
                    {
                        label: "Edit Order",
                        icon: ArrowUpDown,
                        onClick: () => goto(`/admin/iot/bundles/${props.bundleId}/apps/${bundleApp.id}/edit`),
                        variant: "outline"
                    },
                    {
                        label: "Remove",
                        icon: Trash,
                        onClick: () => confirmDelete(bundleApp),
                        variant: "destructive"
                    }
                ];

                return {
                    component: RecordActions,
                    props: {
                        items: actions
                    }
                };
            }
        }
    ];
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        bind:open={state.confirmationOpen}
        title={state.title}
        message={state.message}
        confirmButtonText={state.confirmButtonText}
        cancelButtonText={state.cancelButtonText}
        onConfirm={handleDeleteConfirm}
    />

    {#if props.loading}
        <LoadingSkeleton columns={columns.length} rows={3} />
    {:else}
        <DataTable
            data={props.records}
            {columns}
            emptyMessage="No apps added to this bundle yet"
            showPagination={false}
        />
    {/if}
</div>
