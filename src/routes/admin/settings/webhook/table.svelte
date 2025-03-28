<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Trash, Power, PowerOff, Clock } from "lucide-svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import EndpointDisplay from "$lib/components/ui_components_sveltekit/webhook/EndpointDisplay.svelte";
    import type { WebhookEndPoint } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";
    
    // Props for DataTable component
    export let props = {
        records: [] as WebhookEndPoint[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "createdAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as WebhookEndPoint | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(webhook: WebhookEndPoint) {
        state.selectedRecord = webhook;
        state.confirmationOpen = true;
    }
    
    // Webhook to be toggled (for active status change)
    let webhookToToggle: WebhookEndPoint | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(webhook: WebhookEndPoint) {
        webhookToToggle = webhook;
        statusToggleDialogOpen = true;
    }

    // Stores for filters and table state
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );
    $: {
        // Keep selectedStatuses in sync with URL changes
        const urlStatuses = $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlStatuses) !== JSON.stringify($selectedStatuses)) {
            selectedStatuses.set(urlStatuses);
        }
    }

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "25%",
            render: (record: WebhookEndPoint) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/settings/webhook",
                    idField: "id",
                    nameField: "name"
                }
            })
        },
        {
            id: "postfix",
            label: "Endpoint",
            sortable: true,
            width: "25%",
            render: (record: WebhookEndPoint) => ({
                component: EndpointDisplay,
                props: {
                    postfix: record.postfix,
                    basePath: "/api/webhook"
                }
            })
        },
        {
            id: "createdAt",
            label: "Created At",
            sortable: true,
            width: "15%",
            render: (record: WebhookEndPoint) => ({
                component: RelativeDate,
                props: {
                    date: record.createdAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: "lastUsedAt",
            label: "Last Used",
            sortable: true,
            width: "15%",
            render: (record: WebhookEndPoint) => record.lastUsedAt ? ({
                component: RelativeDate,
                props: {
                    date: record.lastUsedAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            }) : "Never"
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "10%",
            render: (record: WebhookEndPoint) => record.status
        },
        {
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: WebhookEndPoint) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/settings/webhook/${record.id}`)
                    },
                    {
                        label: isTogglingStatus && webhookToToggle?.id === record.id 
                            ? "Updating..." 
                            : (record.status === 'ACTIVE' ? "Deactivate" : "Activate"),
                        icon: isTogglingStatus && webhookToToggle?.id === record.id 
                            ? null 
                            : (record.status === 'ACTIVE' ? PowerOff : Power),
                        onClick: () => prepareToggleStatus(record),
                        disabled: isTogglingStatus
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(record)
                    }
                ];
                
                return {
                    component: RecordActions,
                    props: {
                        items: actionItems
                    }
                };
            }
        }
    ];

    // Using imported pagination utilities for table interactions
    // These are already imported from pagination-utils
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        onConfirm={() => {
            // Refresh the page to update the webhook list
            window.location.reload();
        }}
    />
    
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        action="?/toggleStatus"
        bind:record={webhookToToggle}
        bind:isProcessing={isTogglingStatus}
        onSuccess={(result) => {
            // Update the webhook status in the local data without page refresh
            if (webhookToToggle) {
                const newStatus = webhookToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                
                // Find and update the webhook in the records array
                const index = props.records.findIndex(r => r.id === webhookToToggle.id);
                if (index !== -1) {
                    props.records[index].status = newStatus;
                    // Force a UI update
                    props = { ...props };
                }
                
                toast.success(`Webhook ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
                
                // Reset the webhookToToggle and close dialog
                webhookToToggle = null;
                statusToggleDialogOpen = false;
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update webhook status: ${result.data?.error || 'Unknown error'}`);
            webhookToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        <input type="hidden" name="id" value={webhookToToggle?.id || ''} />
        <input type="hidden" name="status" value={webhookToToggle?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'} />
        <button type="submit" class="hidden">Submit</button>
    </RecordUpdateDialog>
    {#if props.loading}
        <div class="space-y-4">
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
        </div>
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name or postfix..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" }
                ]}
                selectedValues={$selectedStatuses}
                key="statuses"
            />
        </div>

        <!-- Data table -->
        <DataTable
            {columns}
            {props}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
