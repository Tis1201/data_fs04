<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import Badge from "$lib/components/ui/badge/badge.svelte";
    import { Pencil, Trash, Download, Package } from "lucide-svelte";
    import type { Resource } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { api_post } from "$lib/utils/ApiUtils";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort as originalHandleTableSort, handleTablePagination as originalHandleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    
    // Wrapper functions to ensure events are properly formatted
    function handleTableSort(event: CustomEvent) {
        // Make sure we're passing a properly formatted CustomEvent
        originalHandleTableSort(event);
    }
    
    function handleTablePagination(event: CustomEvent) {
        // Make sure we're passing a properly formatted CustomEvent
        originalHandleTablePagination(event);
    }
    import { enhance } from "$app/forms";
    import { formatBytes } from "$lib/utils/format";

    // Props for DataTable component
    export let props = {
        records: [] as Resource[],
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
        selectedRecord: null as Resource | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(resource: Resource) {
        state.selectedRecord = resource;
        state.confirmationOpen = true;
    }
    
    // Handle delete confirmation
    function handleDeleteConfirm() {
        // This would be implemented if not using form submission
        // For now, we're using the form submission approach
    }

    // Get resource type display name
    function getResourceTypeDisplay(type: string) {
        const typeMap = {
            'file': 'File',
            'image': 'Image',
            'video': 'Video',
            'document': 'Document',
            'binary': 'Binary'
        };
        return typeMap[type] || type;
    }

    // Get resource target display name
    function getResourceTargetDisplay(target: string) {
        const targetMap = {
            'user': 'User',
            'device': 'Device',
            'account': 'Account'
        };
        return targetMap[target] || target;
    }

    // Get resource format badge variant
    function getFormatBadgeVariant(format: string | null) {
        if (!format) return 'outline';
        
        const formatVariants = {
            'apk': 'default',
            'bin': 'secondary',
            'exe': 'destructive',
            'sh': 'warning'
        };
        return formatVariants[format] || 'outline';
    }

    // Table columns definition
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            render: (resource: Resource) => {
                return {
                    component: NameWithIdLink,
                    props: {
                        record: resource,
                        baseUrl: "/admin/iot/resources",
                        idField: "id",
                        nameField: "name"
                    }
                };
            }
        },
        {
            id: "type",
            label: "Type",
            sortable: true,
            render: (resource: Resource) => {
                return {
                    component: Badge,
                    props: {
                        variant: 'outline',
                        class: "whitespace-nowrap"
                    },
                    children: getResourceTypeDisplay(resource.type)
                };
            }
        },
        {
            id: "target",
            label: "Target",
            sortable: true,
            render: (resource: Resource) => {
                return {
                    component: Badge,
                    props: {
                        variant: 'secondary',
                        class: "whitespace-nowrap"
                    },
                    children: getResourceTargetDisplay(resource.target)
                };
            }
        },
        {
            id: "version",
            label: "Version",
            sortable: true,
            render: (resource: Resource) => resource.version || '-'
        },
        {
            id: "format",
            label: "Format",
            sortable: true,
            render: (resource: Resource) => {
                if (!resource.format) return '-';
                return {
                    component: Badge,
                    props: {
                        variant: getFormatBadgeVariant(resource.format),
                        class: "whitespace-nowrap"
                    },
                    children: resource.format.toUpperCase()
                };
            }
        },
        {
            id: "size",
            label: "Size",
            sortable: true,
            render: (resource: Resource) => formatBytes(resource.size)
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            render: (resource: Resource) => {
                return {
                    component: RelativeDate,
                    props: {
                        date: resource.createdAt
                    }
                };
            }
        },
        {
            id: "actions",
            label: "",
            sortable: false,
            render: (resource: Resource) => {
                const actions: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/iot/resources/${resource.id}/edit`)
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(resource),
                        variant: "destructive"
                    }
                ];

                // Add download action if it's a downloadable resource
                if (resource.path) {
                    actions.splice(1, 0, {
                        label: "Download",
                        icon: Download,
                        onClick: () => window.open(resource.path, '_blank'),
                        variant: "outline"
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
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        state={{
            selectedRecord: state.selectedRecord,
            confirmationOpen: state.confirmationOpen
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Resource"
        getDescription={(resource) => `Are you sure you want to delete this resource? This action cannot be undone.`}
        actionName="delete"
        action="?/delete"
    />

    <!-- Data Table -->
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <DataTable
            props={{
                records: props.records,
                pagination: props.pagination,
                sort: props.sort
            }}
            columns={columns}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination}
        />
    {/if}
</div>
