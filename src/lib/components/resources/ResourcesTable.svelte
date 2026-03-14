<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import RecordActions from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import {Download, Pencil, Trash} from "lucide-svelte";
    import type {Resource} from "@prisma/client";
    import {goto} from "$app/navigation";
    import {page} from "$app/stores";
    import {
        handleTablePagination as originalHandleTablePagination,
        handleTableSort as originalHandleTableSort
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import {formatBytes} from "$lib/utils/format";
    import { downloadResource } from '$lib/utils/download';
    import { toast } from 'svelte-sonner';
    
    type ActionItem = {
        label: string;
        icon: any;
        onClick: () => void;
        variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    };

    // Wrapper functions to ensure events are properly formatted
    function handleTableSort(event: CustomEvent) {
        originalHandleTableSort(event);
    }

    function handleTablePagination(event: CustomEvent) {
        originalHandleTablePagination(event);
    }

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

    // Base URL for links (different for admin vs user routes)
    export let baseUrl: string = "/admin/iot/resources";

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
        if (!state.selectedRecord) return;
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "?/delete";
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "id";
        input.value = state.selectedRecord.id;
        form.appendChild(input);
        document.body.appendChild(form);
        form.requestSubmit();
    }

    // Normalization helper to treat "undefined" / empty as absent
    function normalizeField(value: string | null | undefined) {
        if (!value || value === "undefined") return undefined;
        return value;
    }

    // Get resource type display name
    function getResourceTypeDisplay(type: string | undefined) {
        const typeMap: Record<string, string> = {
            file: "File",
            image: "Image",
            video: "Video",
            document: "Document",
            binary: "Binary"
        };
        if (!type) return "-";
        return typeMap[type] || type;
    }

    // Get resource target display name
    function getResourceTargetDisplay(target: string | undefined) {
        const targetMap: Record<string, string> = {
            user: "User",
            device: "Device",
            account: "Account"
        };
        if (!target) return "-";
        return targetMap[target] || target;
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
                        baseUrl: baseUrl,
                        idField: "id",
                        nameField: "name",
                        showId: true
                    }
                };
            }
        },
        {
            id: "type",
            label: "Type",
            sortable: true,
            render: (resource: Resource) => {
                const raw = normalizeField(resource.type);
                return getResourceTypeDisplay(raw);
            }
        },
        {
            id: "target",
            label: "Target",
            sortable: true,
            render: (resource: Resource) => {
                const raw = normalizeField(resource.target);
                return getResourceTargetDisplay(raw);
            }
        },
        {
            id: "packageName",
            label: "Package Name",
            sortable: true,
            render: (resource: Resource) => resource.packageName || '-'
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
                const raw = normalizeField(resource.format);
                return raw ? raw.toUpperCase() : '-';
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
                        label: "View",
                        icon: Pencil,
                        onClick: () => goto(`${baseUrl}/${resource.id}`)
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(resource),
                        variant: "destructive"
                    }
                ];

                if (resource.path) {
                    actions.splice(1, 0, {
                        label: "Download",
                        icon: Download,
                        onClick: async () => {
                            try {
                                await downloadResource(resource.id, resource.name || resource.path?.split('/').pop() || 'resource');
                            } catch (e) {
                                toast.error('Download failed: ' + (e instanceof Error ? e.message : 'Unknown error'));
                            }
                        },
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
        <div class="flex items-center gap-2 mb-4">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name, type, or package name..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
        </div>

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

