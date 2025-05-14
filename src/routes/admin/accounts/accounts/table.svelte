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
    import { Badge } from "$lib/components/ui/badge";
    import { Pencil, Trash, Power, Building, Users, Router } from "lucide-svelte";
    import type { Account } from "@prisma/client";
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
        records: [] as Account[],
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
        selectedRecord: null as Account | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(account: Account) {
        state.selectedRecord = account;
        state.confirmationOpen = true;
    }
    
    // Account to be toggled (for status change)
    let accountToToggle: Account | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(account: Account) {
        accountToToggle = account;
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
    
    // Clean up legacy URL parameters
    onMount(() => {
        if (!browser) return;
        
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });

    // Function to get badge variant based on status
    function getStatusBadge(status: string) {
        const statusText = status || "UNKNOWN";
        let variant = "default";
        
        switch (statusText) {
            case "ACTIVE":
                variant = "success";
                break;
            case "INACTIVE":
                variant = "secondary";
                break;
            case "PENDING":
                variant = "warning";
                break;
            default:
                variant = "default";
        }
        
        return {
            component: Badge,
            props: {
                variant,
                class: "capitalize",
                children: statusText.toLowerCase()
            }
        };
    }

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: Account) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Account'
                    },
                    baseUrl: '/admin/accounts/accounts',
                    showId: true
                }
            })
        },
        {
            id: "slug",
            label: "Slug",
            sortable: true,
            width: "15%",
            render: (record: Account) => record.slug || "N/A"
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "10%",
            render: (record: Account) => getStatusBadge(record.status)
        },
        {
            id: "companies",
            label: "Companies",
            width: "10%",
            render: (record: Account) => record._count?.companies || 0
        },
        {
            id: "members",
            label: "Members",
            width: "10%",
            render: (record: Account) => record._count?.members || 0
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: Account) => ({
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
            id: "actions",
            label: "Actions",
            width: "10%",
            render: (record: Account) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "View Companies",
                        icon: Building,
                        onClick: () => goto(`/admin/accounts/accounts/${record.id}/companies`)
                    },
                    {
                        label: "View Members",
                        icon: Users,
                        onClick: () => goto(`/admin/accounts/accounts/${record.id}/members`)
                    },
                    {
                        label: "View Devices",
                        icon: Router,
                        onClick: () => goto(`/admin/accounts/accounts/${record.id}/devices`)
                    },
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/accounts/accounts/${record.id}/edit`)
                    },
                    {
                        label: record.status === 'ACTIVE' ? "Deactivate" : "Activate",
                        icon: Power,
                        onClick: () => prepareToggleStatus(record)
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
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        {state}
        action="?/deleteAccount"
        onConfirm={() => {
            // Refresh the page to update the account list
            window.location.reload();
        }}
    />
    
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        action="?/toggleStatus"
        bind:record={accountToToggle}
        bind:isProcessing={isTogglingStatus}
        onSuccess={(result) => {
            // Update the account status in the local data without page refresh
            if (accountToToggle) {
                const newStatus = accountToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                
                // Find and update the account in the records array
                const index = props.records.findIndex(r => r.id === accountToToggle.id);
                if (index !== -1) {
                    props.records[index].status = newStatus;
                    // Force a UI update
                    props = { ...props };
                }
                
                toast.success(`Account ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
                
                // Reset the accountToToggle and close dialog
                accountToToggle = null;
                statusToggleDialogOpen = false;
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update account status: ${result.data?.error || 'Unknown error'}`);
            accountToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        <input type="hidden" name="id" value={accountToToggle?.id || ''} />
        <input type="hidden" name="status" value={accountToToggle?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'} />
        <button type="submit" class="hidden">Submit</button>
    </RecordUpdateDialog>
    
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name, ID, or slug..."
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
