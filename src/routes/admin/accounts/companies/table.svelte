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
    import { Pencil, Trash, Power, Building } from "lucide-svelte";
    import type { Company } from "@prisma/client";
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
        records: [] as Company[],
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
        loading: false,
        filters: {
            industries: [] as string[],
            accounts: [] as {id: string, name: string}[]
        }
    };
    
    // State for confirmation dialog
    let state = {
        selectedRecord: null as Company | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(company: Company) {
        state.selectedRecord = company;
        state.confirmationOpen = true;
    }
    
    // Company to be toggled (for status change)
    let companyToToggle: Company | null = null;
    let isTogglingStatus = false;
    let statusToggleDialogOpen = false;
    
    // Function to prepare for status toggle
    function prepareToggleStatus(company: Company) {
        companyToToggle = company;
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
</script>

<!-- Column definitions for the companies table -->
<script lang="ts" context="module">
    import { Badge } from "$lib/components/ui/badge";
    
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
    
    // Define columns for the companies table
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: Company) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Company'
                    },
                    baseUrl: '/admin/accounts/companies',
                    showId: true
                }
            })
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            width: "10%",
            render: (record: Company) => getStatusBadge(record.status)
        },
        {
            id: "address",
            label: "Address",
            sortable: false,
            width: "15%",
            render: (record: Company) => record.address || "N/A"
        },
        {
            id: "contactEmail",
            label: "Contact Email",
            sortable: false,
            width: "15%",
            render: (record: Company) => record.contactEmail || "N/A"
        },
        {
            id: "devices",
            label: "Devices",
            width: "10%",
            render: (record: Company) => record._count?.devices || 0
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: Company) => ({
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
            render: (record: Company) => {
                // Define action items here instead of in the RecordActions component
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit Company",
                        icon: Pencil,
                        onClick: () => goto(`/admin/accounts/companies/${record.id}`)
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
        actionName="deleteCompany"
        onConfirm={() => {
            // Refresh the page to update the company list
            window.location.reload();
        }}
    />
    
    <!-- Status Toggle Dialog -->
    <RecordUpdateDialog
        bind:open={statusToggleDialogOpen}
        action="?/toggleStatus"
        bind:record={companyToToggle}
        bind:isProcessing={isTogglingStatus}
        onSuccess={(result) => {
            // Update the company status in the local data without page refresh
            if (companyToToggle) {
                const newStatus = companyToToggle.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                
                // Find and update the company in the records array
                const index = props.records.findIndex(r => r.id === companyToToggle.id);
                if (index !== -1) {
                    props.records[index].status = newStatus;
                    // Force a UI update
                    props = { ...props };
                }
                
                toast.success(`Company ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
                
                // Reset the companyToToggle and close dialog
                companyToToggle = null;
                statusToggleDialogOpen = false;
            }
        }}
        onError={(result) => {
            toast.error(`Failed to update company status: ${result.data?.error || 'Unknown error'}`);
            companyToToggle = null;
            statusToggleDialogOpen = false;
        }}
    >
        <input type="hidden" name="id" value={companyToToggle?.id || ''}>
        <input type="hidden" name="status" value={companyToToggle?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}>
        <button type="submit" class="hidden">Submit</button>
    </RecordUpdateDialog>

    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name, ID, or email..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Account filter -->
            <PopoverFilter
                label="Account"
                options={props.filters.accounts?.map(account => ({ label: account.name, value: account.id })) || []}
                selectedValues={$page.url.searchParams.get('accountId')?.split(',').filter(Boolean) || []}
                key="accountId"
            />
            
            <!-- Status filter -->
            {#if props.filters.industries && props.filters.industries.length > 0}
                <PopoverFilter
                    label="Status"
                    options={props.filters.industries.map(status => ({ label: status.toLowerCase(), value: status }))}
                    selectedValues={$selectedStatuses}
                    key="statuses"
                />
            {/if}
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
