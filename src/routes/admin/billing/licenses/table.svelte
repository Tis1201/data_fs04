<script lang="ts">
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import NameWithIdLink from "$lib/components/ui_components_sveltekit/table/column/NameWithIdLink.svelte";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import { Download, Pencil, Trash, KeyRound } from "lucide-svelte";
    import { writable } from "svelte/store";

    import type { License } from "@prisma/client";
    import { page } from "$app/stores";
    import { goto, invalidate } from "$app/navigation";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Simple function to refresh data from the server
    async function refreshData() {
        await invalidate('app:licenses');
    }

    export let props = {
        records: [] as License[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "issuedAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };

    // Column definitions
    const columns = [
        {
            id: "keyId",
            label: "License",
            sortable: true,
            width: "18%",
            render: (record: License) => ({
                component: NameWithIdLink,
                props: {
                    record: { id: record.id, name: record.keyId || record.id },
                    baseUrl: '/admin/billing/licenses',
                    showId: true
                }
            })
        },
        {
            id: "accountId",
            label: "Account",
            sortable: true,
            width: "16%",
            render: (record: License) => (record as any)?.account?.name ?? record.accountId
        },
        {
            id: "deviceId",
            label: "Device",
            sortable: true,
            width: "16%",
            render: (record: License) => record.deviceId || '—'
        },
        {
            id: "status",
            label: "Status",
            width: "12%",
            render: (record: License) => ({
                component: StatusBadge,
                props: { status: record.status?.toLowerCase?.() || 'unknown' }
            })
        },
        {
            id: "issuedAt",
            label: "Issued",
            sortable: true,
            width: "14%",
            render: (record: License) => ({
                component: RelativeDate,
                props: { date: record.issuedAt, format: 'relative', showTooltip: true, useHoverCard: true, iconSize: 12 }
            })
        },
        {
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "14%",
            render: (record: License) => ({
                component: RelativeDate,
                props: { date: record.expiresAt, format: 'relative', showTooltip: true, useHoverCard: true, iconSize: 12 }
            })
        },
        // {
        //     id: "algorithm",
        //     label: "Alg",
        //     sortable: true,
        //     width: "10%",
        //     render: (record: License) => record.algorithm
        // },
        {
            id: "actions",
            label: "",
            sortable: false,
            width: "10%",
            render: (license: License) => {
                const actions: ActionItem[] = [
                    {
                        label: "View",
                        icon: Pencil,
                        onClick: () => goto(`/admin/billing/licenses/${license.id}`)
                    },
                    {
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(license),
                        variant: "destructive"
                    }
                ];

                // Add download action if JWT is available
                if (license.jwt) {
                    actions.splice(1, 0, {
                        label: "Download JWT",
                        icon: KeyRound,
                        onClick: () => {
                            const element = document.createElement('a');
                            const file = new Blob([license.jwt], {type: 'text/plain'});
                            element.href = URL.createObjectURL(file);
                            element.download = `license_${license.id}.jwt`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
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

    // State for confirmation dialog
    let state = {
        selectedRecord: null as License | null,
        confirmationOpen: false,
        title: "Delete License",
        message: "Are you sure you want to delete this license? This action cannot be undone.",
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel"
    };

    // Function to open delete confirmation dialog
    function confirmDelete(license: License) {
        state.selectedRecord = license;
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
        document.body.appendChild(form);
        form.requestSubmit();
    }

    onMount(() => {
        if (!browser) return;
        // no-op for now
        const url = new URL(window.location.href);
        let needsRedirect = false;
        
        if (needsRedirect) {
            goto(url.toString(), { replaceState: true, noScroll: true });
        }
    });

    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );
</script>

<div class="space-y-4">
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex flex-wrap gap-2 mb-4">
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by account, device, keyId..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>

            <PopoverFilter
                label="Status"
                options={[
                    { label: 'Active', value: 'ACTIVE' },
                    { label: 'Revoked', value: 'REVOKED' },
                    { label: 'Expired', value: 'EXPIRED' },
                    { label: 'Suspended', value: 'SUSPENDED' }
                ]}
                selectedValues={$selectedStatuses}
                key="statuses"
            />
        </div>

        <DataTable 
            {columns} 
            props={props}
            on:sort={handleTableSort}
            on:pagination={handleTablePagination} />

        <!-- Delete Confirmation Dialog -->
        <RecordDeleteDialog
            {state}
            onConfirm={() => {}}
            title="Delete License"
            getDescription={(license) => `Are you sure you want to delete this license? This action cannot be undone.`}
            actionName="delete"
            action="?/delete"
        />
    {/if}
</div>
