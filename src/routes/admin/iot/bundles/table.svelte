<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import { Pencil, Trash, Play, Package } from "lucide-svelte";
    import type { Bundle } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";
    import { invalidate } from '$app/navigation';
    import { mqttClient } from '$lib/client/mqtt/mqttClient';
    import OnlineDot from "$lib/components/ui_components_sveltekit/devices/OnlineDot.svelte";

    // Props for DataTable component
    export let props = {
        records: [] as Bundle[],
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
        selectedRecord: null as Bundle | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(bundle: Bundle) {
        state.selectedRecord = bundle;
        state.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    function handleDeleteConfirm() {
        // This would be implemented if not using form submission
        // For now, we're using the form submission approach
    }
    
    // Simple function to refresh data from the server
    async function refreshData() {
        // This will trigger a reload of the page data without a full page refresh
        await invalidate('app:bundles');
    }

    // Subscribe to connection events to update device status in real time
    onMount(() => {
        // MQTT notifications are handled automatically - no manual subscription needed
        // Device connection status updates will be received via MQTT notifications
        // Components using device data will automatically reflect connection status changes
        console.log('[BundleTable] Device status updates handled automatically via MQTT');
    });

    // Status label and variant mapping for bundles (pretty text and colored badge)
    function getBundleStatusLabel(status: string | null | undefined): string {
        if (!status) return 'Unknown';
        const map: Record<string, string> = {
            'DRAFT': 'Draft',
            'PUBLISHED': 'Published',
            'IN_PROGRESS': 'In Progress',
            'CANCELLED': 'Cancelled',
            'COMPLETED': 'Completed',
            'FAILED': 'Failed'
        };
        return map[status] || String(status);
    }
    import { Badge } from "$lib/components/ui/badge";

    // List view: plain span with colored text and border (no Badge component)
    function getStatusTextBorderClasses(status: string | null | undefined): string {
        if (!status) return 'text-zinc-700 border-zinc-200';
        const map: Record<string, string> = {
            DRAFT: 'text-zinc-900 border-zinc-200',
            // Published = neutral gray; In Progress = blue
            PUBLISHED: 'text-zinc-700 border-zinc-300',
            IN_PROGRESS: 'text-blue-700 border-blue-300',
            CANCELLED: 'text-red-700 border-red-200',
            COMPLETED: 'text-green-700 border-green-200',
            FAILED: 'text-red-700 border-red-200'
        };
        return map[status] || 'text-zinc-800 border-zinc-200';
    }

    // Subtle text color for list view (no pill/background)
    function getBundleStatusTextClass(status: string | null | undefined): string {
        if (!status) return 'text-muted-foreground';
        const map: Record<string, string> = {
            DRAFT: 'text-muted-foreground',
            PUBLISHED: 'text-blue-600',
            IN_PROGRESS: 'text-blue-600',
            CANCELLED: 'text-red-600',
            COMPLETED: 'text-green-600',
            FAILED: 'text-red-600'
        };
        return map[status] || 'text-muted-foreground';
    }

    // Table columns definition
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            render: (bundle: Bundle) => {
                return {
                    component: NameWithIdLink,
                    props: {
                        record: bundle,
                        baseUrl: "/admin/iot/bundles",
                        idField: "id",
                        nameField: "name"
                    }
                };
            }
        },
        {
            id: "version",
            label: "Version",
            sortable: true,
            render: (bundle: Bundle) => bundle.version || '-'
        },
        {
            id: "status",
            label: "Status",
            sortable: true,
            render: (bundle: Bundle) => {
                const text = getBundleStatusLabel(bundle.status);
                const cls = getStatusTextBorderClasses(bundle.status);
                return `<span class=\"inline-block whitespace-nowrap text-xs font-medium rounded-full px-2 py-0.5 border ${cls}\">${text}</span>`;
            }
        },
        {
            id: "scheduledAt",
            label: "Scheduled",
            sortable: true,
            render: (bundle: Bundle) => {
                if (!bundle.scheduledAt) return '-';
                return {
                    component: RelativeDate,
                    props: {
                        date: bundle.scheduledAt
                    }
                };
            }
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            render: (bundle: Bundle) => {
                return {
                    component: RelativeDate,
                    props: {
                        date: bundle.createdAt
                    }
                };
            }
        },
        {
            id: "actions",
            label: "",
            sortable: false,
            render: (bundle: Bundle) => {
                const actions = [
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(bundle),
                        variant: "destructive"
                    }
                ];

                // Add deploy action if it's a draft bundle
                if (bundle.status === 'DRAFT') {
                    actions.unshift({
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/iot/bundles/${bundle.id}/edit`)
                    });

                    actions.splice(1, 0, {
                        label: "Deploy",
                        icon: Play,
                        onClick: () => goto(`/admin/iot/bundles/${bundle.id}/deploy`),
                        variant: "default"
                    });
                }

                return {
                    component: RecordActions,
                    props: {
                        items: actions
                    }
                };
            }
        }
    ];

    // Filter options
    const statusOptions = [
        { label: "All Statuses", value: "" },
        { label: "Draft", value: "DRAFT" },
        { label: "Published", value: "PUBLISHED" },
        { label: "Cancelled", value: "CANCELLED" },
        { label: "Completed", value: "COMPLETED" },
        { label: "Failed", value: "FAILED" }
    ];

    const osOptions = [
        { label: "All OS", value: "" },
        { label: "Android", value: "ANDROID" },
        { label: "iOS", value: "IOS" }
    ];

    // Filter components
    const filters = [
        {
            id: "search",
            component: DebouncedTextFilter,
            props: {
                placeholder: "Search bundles...",
                queryParam: "search"
            }
        },
        {
            id: "status",
            component: PopoverFilter,
            props: {
                label: "Status",
                options: statusOptions,
                queryParam: "status"
            }
        },
        {
            id: "os",
            component: PopoverFilter,
            props: {
                label: "OS",
                options: osOptions,
                queryParam: "os"
            }
        }
    ];
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
        <RecordDeleteDialog
        state={{
            selectedRecord: state.selectedRecord,
            confirmationOpen: state.confirmationOpen,
            title: 'Delete Bundle',
            message: state.selectedRecord ? `Are you sure you want to delete bundle ${state.selectedRecord.name || state.selectedRecord.id}? This action cannot be undone.` : '',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        }}
        useFormSubmission={true}
        action="?/delete"
            onConfirm={() => {}}
        on:close={() => {
            state.confirmationOpen = false;
            state.selectedRecord = null;
        }}
    />

    <!-- Data Table -->
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex flex-wrap gap-2 mb-4">
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search bundles..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={statusOptions.filter(opt => opt.value !== '')}
                selectedValues={$page.url.searchParams.get('status') ? [$page.url.searchParams.get('status') || ''] : []}
                onChange={(values) => {
                    const url = new URL(window.location.href);
                    if (values.length && values[0]) {
                        url.searchParams.set('status', values[0]);
                    } else {
                        url.searchParams.delete('status');
                    }
                    url.searchParams.set('page', '1');
                    goto(url.toString(), { replaceState: true, noScroll: true });
                }}
            />
        </div>
        
        <DataTable
            props={{
                records: props.records,
                pagination: props.pagination,
                sort: props.sort
            }}
            columns={columns}
            on:sort={(e) => handleTableSort(e)}
            on:pagination={(e) => handleTablePagination(e)}
        />
    {/if}
</div>
