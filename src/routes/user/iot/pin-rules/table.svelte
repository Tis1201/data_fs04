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
    import { Badge } from "$lib/components/ui/badge";
    import { Pencil, Trash, Pin } from "lucide-svelte";
    import type { PinRule } from "@prisma/client";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { writable } from "svelte/store";
    import { toast } from "svelte-sonner";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import { enhance } from "$app/forms";

    // Define ActionItem type
    interface ActionItem {
        label: string;
        icon: any;
        onClick: () => void;
    }

    export let currentUserId: string | undefined;
    export let accountRole: string | undefined; // OWNER, ADMIN, MEMBER

    // Define PinRule type with _count field
    type PinRuleWithCount = PinRule & {
        _count?: {
            userActions: number;
        };
    };

    // Props for DataTable component
    export let props = {
        records: [] as PinRuleWithCount[],
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
        selectedRecord: null as PinRuleWithCount | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete(rule: PinRuleWithCount) {
        state.selectedRecord = rule;
        state.confirmationOpen = true;
    }

    // Stores for filters and table state
    const selectedRuleTypes = writable<string[]>(
        $page.url.searchParams.get("ruleTypes")?.split(",").filter(Boolean) ?? []
    );
    
    const selectedStatuses = writable<string[]>(
        $page.url.searchParams.get("statuses")?.split(",").filter(Boolean) ?? []
    );
    
    $: {
        // Keep selectedRuleTypes in sync with URL changes
        const urlRuleTypes = $page.url.searchParams.get("ruleTypes")?.split(",").filter(Boolean) ?? [];
        if (JSON.stringify(urlRuleTypes) !== JSON.stringify($selectedRuleTypes)) {
            selectedRuleTypes.set(urlRuleTypes);
        }
        
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

    // Function to get badge variant based on rule type
    function getRuleTypeBadge(ruleType: string) {
        const typeText = ruleType || "UNKNOWN";
        let variant = "default";

        switch (typeText) {
            case "admin_default":
                variant = "Admin default";
                break;
            case "admin_custom":
                variant = "Admin custom";
                break;
            case "user_default":
                variant = "User default";
                break;
            case "user_custom":
                variant = "User custom";
                break;
            default:
                variant = "default";
        }

        return variant;
    }

    // Function to get badge variant based on status
    function getStatusBadge(isActive: boolean) {
        return isActive ? "Active" : "Inactive";
    }

    // Column definitions
    const columns = [
        {
            id: "name",
            label: "Name",
            sortable: true,
            width: "20%",
            render: (record: PinRuleWithCount) => ({
                component: NameWithIdLink,
                props: {
                    record: {
                        id: record.id,
                        name: record.name || 'Unnamed Rule'
                    },
                    baseUrl: '/user/iot/pin-rules',
                    showId: true
                }
            })
        },
        {
            id: "ruleType",
            label: "Type",
            sortable: true,
            width: "15%",
            render: (record: PinRuleWithCount) => getRuleTypeBadge(record.ruleType)
        },
        {
            id: "apps",
            label: "Apps",
            width: "15%",
            render: (record: PinRuleWithCount) => `${record.apps.length} app${record.apps.length !== 1 ? 's' : ''}`
        },
        {
            id: "targetType",
            label: "Target",
            sortable: true,
            width: "15%",
            render: (record: PinRuleWithCount) => record.targetType === 'all' ? 'All Devices' : `${record.targetValue.length} Device${record.targetValue.length !== 1 ? 's' : ''}`
        },
        {
            id: "isActive",
            label: "Status",
            sortable: true,
            width: "10%",
            render: (record: PinRuleWithCount) => getStatusBadge(record.isActive)
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: PinRuleWithCount) => ({
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
            render: (record: PinRuleWithCount) => {
                // Similar to admin: all rules are editable, but default rules cannot be deleted
                const isDefault = record.ruleType === 'user_default';
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit Rule",
                        icon: Pencil,
                        onClick: () => goto(`/user/iot/pin-rules/${record.id}/edit`)
                    },
                    // Only show delete for non-default rules (user_custom)
                    ...(isDefault ? [] : [{
                        label: "Delete",
                        icon: Trash,
                        onClick: () => confirmDelete(record)
                    } as ActionItem])
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
        action="?/deletePinRule"
        actionName="deletePinRule"
        onConfirm={() => {}}
    >
        <input type="hidden" name="id" value={state.selectedRecord?.id || ''} />
    </RecordDeleteDialog>
    
    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by name, description, or apps..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Rule Type filter -->
            <PopoverFilter
                label="Rule Type"
                options={[
                    { label: "User Default", value: "user_default" },
                    { label: "User Custom", value: "user_custom" }
                ]}
                selectedValues={$selectedRuleTypes}
                key="ruleTypes"
            />
            
            <!-- Status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: "Active", value: "true" },
                    { label: "Inactive", value: "false" }
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

