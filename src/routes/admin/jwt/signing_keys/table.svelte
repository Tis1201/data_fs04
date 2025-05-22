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
    import { Pencil, Trash, Power, Star } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Define the JwtSigningKey type
    interface JwtSigningKey {
        id: string;
        keyId: string;
        keyType: string;
        algorithm: string;
        isActive: boolean;
        isPrimary: boolean;
        rotatedAt: string | null;
        expiresAt: string | null;
        createdAt: string;
        updatedAt: string;
        createdBy: {
            id: string;
            name: string | null;
            email: string;
        };
    }

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
            keyTypeOptions: [] as {id: string, name: string}[],
            keyTypes: [] as string[],
            isActive: ''
        }
    };
    
    // State for confirmation dialogs
    let deleteState = {
        selectedRecord: null as JwtSigningKey | null,
        confirmationOpen: false
    };

    let primaryState = {
        selectedRecord: null as JwtSigningKey | null,
        confirmationOpen: false
    };

    let toggleState = {
        selectedRecord: null as JwtSigningKey | null,
        confirmationOpen: false,
        newStatus: false
    };
    
    // Functions to open confirmation dialogs
    function confirmDelete(key: JwtSigningKey) {
        deleteState.selectedRecord = key;
        deleteState.confirmationOpen = true;
    }

    function confirmSetPrimary(key: JwtSigningKey) {
        primaryState.selectedRecord = key;
        primaryState.confirmationOpen = true;
    }

    function confirmToggleActive(key: JwtSigningKey, newStatus: boolean) {
        toggleState.selectedRecord = key;
        toggleState.newStatus = newStatus;
        toggleState.confirmationOpen = true;
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

<!-- Column definitions for the JWT signing keys table -->
<script lang="ts" context="module">
    import { Badge } from "$lib/components/ui/badge";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
    
    // Define columns for the JWT signing keys table
    const columns = [
        {
            id: "keyId",
            label: "Key ID",
            sortable: true,
            width: "20%",
            render: (record: JwtSigningKey) => ({
                component: NameWithIdLink,
                props: {
                    record,
                    nameField: "keyId",
                    baseUrl: "/admin/jwt/signing_keys",
                    showId: true,
                    showBadge: record.isPrimary,
                    badgeText: "Primary",
                    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200"
                }
            })
        },
        {
            id: "keyType",
            label: "Type",
            sortable: true,
            width: "10%",
            render: (record: JwtSigningKey) => ({
                component: Badge,
                props: {
                    variant: "outline",
                    class: getKeyTypeBadgeClass(record.keyType)
                },
                children: record.keyType
            })
        },
        {
            id: "algorithm",
            label: "Algorithm",
            width: "10%",
            render: (record: JwtSigningKey) => record.algorithm
        },
        {
            id: "isActive",
            label: "Status",
            width: "10%",
            render: (record: JwtSigningKey) => ({
                component: StatusBadge,
                props: {
                    status: record.isActive ? "ACTIVE" : "INACTIVE"
                }
            })
        },
        {
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "15%",
            render: (record: JwtSigningKey) => 
                record.expiresAt ? {
                    component: RelativeDate,
                    props: {
                        date: record.expiresAt,
                        format: "relative",
                        showTooltip: true,
                        useHoverCard: true,
                        iconSize: 12
                    }
                } : "Never"
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "15%",
            render: (record: JwtSigningKey) => ({
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
            width: "20%",
            render: (record: JwtSigningKey) => {
                // Define action items here
                const actionItems: ActionItem[] = [
                    {
                        label: "Edit",
                        icon: Pencil,
                        onClick: () => goto(`/admin/jwt/signing_keys/${record.id}`)
                    }
                ];
                
                // Add Set Primary action if not already primary
                if (!record.isPrimary && record.isActive) {
                    actionItems.push({
                        label: "Set Primary",
                        icon: Star,
                        onClick: () => confirmSetPrimary(record)
                    });
                }
                
                // Add Toggle Active action
                actionItems.push({
                    label: record.isActive ? "Deactivate" : "Activate",
                    icon: Power,
                    onClick: () => confirmToggleActive(record, !record.isActive)
                });
                
                // Add Delete action
                actionItems.push({
                    label: "Delete",
                    icon: Trash,
                    onClick: () => confirmDelete(record)
                });
                
                return {
                    component: RecordActions,
                    props: {
                        items: actionItems
                    }
                };
            }
        }
    ];

    // Helper function to get badge class based on key type
    function getKeyTypeBadgeClass(keyType: string): string {
        switch (keyType) {
            case 'RUNTIME':
                return 'bg-blue-50 text-blue-800 border-blue-200';
            case 'FACTORY':
                return 'bg-green-50 text-green-800 border-green-200';
            case 'INVITATION':
                return 'bg-purple-50 text-purple-800 border-purple-200';
            default:
                return 'bg-gray-50 text-gray-800 border-gray-200';
        }
    }
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        state={deleteState}
        actionName="deleteSigningKey"
        onConfirm={() => {
            // Refresh the page to update the signing keys list
            window.location.reload();
        }}
    />
    
    <!-- Set Primary Confirmation Dialog -->
    <RecordUpdateDialog
        state={primaryState}
        title="Set Primary JWT Signing Key"
        description="Are you sure you want to set this key as the primary? This will make it the primary key for signing JWTs of this type."
        actionName="setPrimary"
        buttonText="Set as Primary"
        onConfirm={() => {
            // Refresh the page to update the signing keys list
            window.location.reload();
        }}
    />
    
    <!-- Toggle Active Confirmation Dialog -->
    <RecordUpdateDialog
        state={toggleState}
        title={toggleState.newStatus ? "Activate JWT Signing Key" : "Deactivate JWT Signing Key"}
        description={toggleState.newStatus 
            ? "Are you sure you want to activate this key? It will be available for signing JWTs."
            : "Are you sure you want to deactivate this key? It will no longer be used for signing JWTs."}
        actionName="toggleActive"
        buttonText={toggleState.newStatus ? "Activate" : "Deactivate"}
        extraParams={{ active: toggleState.newStatus }}
        onConfirm={() => {
            // Refresh the page to update the signing keys list
            window.location.reload();
        }}
    />

    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by key ID or ID..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Key type filter -->
            <PopoverFilter
                label="Key Type"
                options={props.filters.keyTypeOptions?.map(type => ({ label: type.name, value: type.id })) || []}
                selectedValues={props.filters.keyTypes || []}
                key="keyTypes"
            />
            
            <!-- Active status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: 'Active', value: 'true' },
                    { label: 'Inactive', value: 'false' }
                ]}
                selectedValues={props.filters.isActive ? props.filters.isActive.split(',') : []}
                key="isActive"
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
