<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import DateRangeFilter from "$lib/components/ui_components_sveltekit/table/filter/DateRangeFilter.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordUpdateDialog from "$lib/components/ui_components_sveltekit/dialog/RecordUpdateDialog.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Key, RotateCw, CheckCircle, XCircle, AlertCircle } from "lucide-svelte";
    import type { JwtSigningKey } from "@prisma/client";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";
    import { onMount, onDestroy } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";
    import { Badge } from "$lib/components/ui/badge";
    import AlgorithmBadge from "$lib/components/ui_components_sveltekit/table/column/AlgorithmBadge.svelte";
    import JwtStatusBadge from "$lib/components/ui_components_sveltekit/table/column/JwtStatusBadge.svelte";
    import DateDisplay from "$lib/components/ui_components_sveltekit/table/column/DateDisplay.svelte";

    // Props for DataTable component
    export let props = {
        records: [] as JwtSigningKey[],
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
            status: $page.url.searchParams.get('status') || ''
        }
    };
    
    // Ensure filters is always defined
    $: props.filters = props.filters || {};
    $: props.filters.status = props.filters.status || '';
    
    // State for confirmation dialogs
    let rotateState = {
        selectedRecord: null as JwtSigningKey | null,
        confirmationOpen: false
    };
    
    // Action to rotate a key
    function handleRotateKey(key: JwtSigningKey) {
        if (key.isPrimary) {
            rotateState.selectedRecord = key;
            rotateState.confirmationOpen = true;
        } else {
            toast.error("Only the primary key can be rotated");
        }
    }
    
    // Filter change handlers
    function handleDateRangeChange(event: CustomEvent<{ startDate: Date | null; endDate: Date | null }>) {
        // The DateRangeFilter component handles URL updates internally
        // We can add additional logic here if needed
    }
</script>

<!-- Column definitions for the factory key history table -->
<script lang="ts" context="module">
    // Define columns for the factory key history table
    const columns = [
        {
            id: "keyId",
            label: "Key ID",
            sortable: true,
            width: "25%",
            render: (record: JwtSigningKey) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    baseUrl: "/admin/jwt/signing_keys/factory",
                    nameField: "keyId",
                    idField: "id",
                    showId: true,
                    showBadge: record.isPrimary,
                    badgeText: "Primary",
                    badgeClass: "bg-green-50 text-green-700 border-green-200"
                }
            })
        },
        {
            id: "algorithm",
            label: "Algorithm",
            sortable: true,
            width: "15%",
            render: (record: JwtSigningKey) => ({
                component: AlgorithmBadge,
                props: {
                    algorithm: record.algorithm
                }
            })
        },
        // {
        //     id: "status",
        //     label: "Status",
        //     sortable: false,
        //     width: "15%",
        //     render: (record: JwtSigningKey) => ({
        //         component: JwtStatusBadge,
        //         props: {
        //             isPrimary: record.isPrimary,
        //             isActive: record.isActive
        //         }
        //     })
        // },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "20%",
            render: (record: JwtSigningKey) => ({
                component: DateDisplay,
                props: {
                    date: record.createdAt,
                    format: "relative",
                    emptyText: "Unknown"
                }
            })
        },
        {
            id: "rotatedAt",
            label: "Rotated",
            sortable: true,
            width: "20%",
            render: (record: JwtSigningKey) => ({
                component: DateDisplay,
                props: {
                    date: record.rotatedAt,
                    format: "relative",
                    emptyText: "Never"
                }
            })
        },
        {
            id: "tokenCount",
            label: "Tokens Signed",
            sortable: true,
            width: "15%",
            render: (record: JwtSigningKey) => {
                // In a real implementation, this would come from the database
                // For now, display N/A for all keys except the primary key
                return {
                    component: "div",
                    props: {
                        class: record.isPrimary ? "font-medium" : "text-gray-500 text-sm",
                        children: record.isPrimary ? "0" : "N/A"
                    }
                };
            }
        },
        {
            id: "actions",
            label: "Actions",
            sortable: false,
            width: "10%",
            render: (record: JwtSigningKey) => {
                const actions: ActionItem[] = [];
                
                // Only show rotate action for primary key
                if (record.isPrimary) {
                    actions.push({
                        label: "Rotate Key",
                        icon: RotateCw,
                        onClick: () => handleRotateKey(record),
                        variant: "ghost"
                    });
                }
                
                return {
                    component: RecordActions,
                    props: {
                        actions
                    }
                };
            }
        }
    ];
</script>

<div class="space-y-4">
    <!-- Rotate Key Confirmation Dialog -->
    <RecordUpdateDialog
        state={rotateState}
        title="Rotate JWT Signing Key"
        description="Are you sure you want to rotate this key? This will create a new primary key and mark the current one as inactive. Existing tokens will still be valid, but new tokens will be signed with the new key."
        actionName="rotateKey"
        buttonText="Rotate Key"
        buttonVariant="destructive"
        onConfirm={() => {
            // Refresh the page to update the keys list
            window.location.reload();
        }}
    />

    <h3 class="text-lg font-medium">Key History</h3>
    
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2 mb-4">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by key ID or algorithm..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Date range filter -->
            <DateRangeFilter
                label="Date Range"
                startParamName="start_date"
                endParamName="end_date"
                on:change={handleDateRangeChange}
            />
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: 'Primary', value: 'primary' },
                    { label: 'Active', value: 'active' },
                    { label: 'Inactive', value: 'inactive' }
                ]}
                selectedValues={props.filters.status ? props.filters.status.split(',') : []}
                key="status"
                singleSelect={false}
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
