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
    import { BanIcon, Trash, UserX, Building } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Define the RefreshToken type
    interface RefreshToken {
        id: string;
        deviceId: string | null;
        userAgent: string | null;
        ipAddress: string | null;
        isRevoked: boolean;
        revokedAt: string | null;
        expiresAt: string;
        createdAt: string;
        account: {
            id: string;
            name: string;
        };
        user: {
            id: string;
            name: string | null;
            email: string;
        };
    }

    // Props for DataTable component
    export let props = {
        records: [] as RefreshToken[],
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
            accounts: [] as { id: string, name: string }[],
            users: [] as { id: string, name: string | null, email: string }[],
            isRevoked: '',
            accountId: '',
            userId: ''
        }
    };
    
    // State for confirmation dialogs
    let deleteState = {
        selectedRecord: null as RefreshToken | null,
        confirmationOpen: false
    };

    let revokeState = {
        selectedRecord: null as RefreshToken | null,
        confirmationOpen: false
    };

    let revokeUserState = {
        selectedRecord: null as RefreshToken | null,
        confirmationOpen: false
    };

    let revokeAccountState = {
        selectedRecord: null as RefreshToken | null,
        confirmationOpen: false
    };
    
    // Functions to open confirmation dialogs
    function confirmDelete(token: RefreshToken) {
        deleteState.selectedRecord = token;
        deleteState.confirmationOpen = true;
    }

    function confirmRevoke(token: RefreshToken) {
        revokeState.selectedRecord = token;
        revokeState.confirmationOpen = true;
    }

    function confirmRevokeAllForUser(token: RefreshToken) {
        revokeUserState.selectedRecord = token;
        revokeUserState.confirmationOpen = true;
    }

    function confirmRevokeAllForAccount(token: RefreshToken) {
        revokeAccountState.selectedRecord = token;
        revokeAccountState.confirmationOpen = true;
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

<!-- Column definitions for the refresh tokens table -->
<script lang="ts" context="module">
    import { Badge } from "$lib/components/ui/badge";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
    
    // Define columns for the refresh tokens table
    const columns = [
        {
            id: "id",
            label: "Token ID",
            sortable: true,
            width: "15%",
            render: (record: RefreshToken) => ({
                component: Badge,
                props: {
                    variant: "outline",
                    class: "font-mono text-xs"
                },
                children: record.id
            })
        },
        {
            id: "user",
            label: "User",
            sortable: false,
            width: "15%",
            render: (record: RefreshToken) => `${record.user.name || 'Unknown'} (${record.user.email})`
        },
        {
            id: "account",
            label: "Account",
            sortable: false,
            width: "15%",
            render: (record: RefreshToken) => record.account.name
        },
        {
            id: "deviceInfo",
            label: "Device Info",
            width: "15%",
            render: (record: RefreshToken) => {
                const deviceId = record.deviceId || 'Unknown';
                const ipAddress = record.ipAddress || 'Unknown';
                return `${deviceId} (${ipAddress})`;
            }
        },
        {
            id: "status",
            label: "Status",
            width: "10%",
            render: (record: RefreshToken) => ({
                component: StatusBadge,
                props: {
                    status: record.isRevoked ? "REVOKED" : "ACTIVE"
                }
            })
        },
        {
            id: "expiresAt",
            label: "Expires",
            sortable: true,
            width: "10%",
            render: (record: RefreshToken) => ({
                component: RelativeDate,
                props: {
                    date: record.expiresAt,
                    format: "relative",
                    showTooltip: true,
                    useHoverCard: true,
                    iconSize: 12
                }
            })
        },
        {
            id: "createdAt",
            label: "Created",
            sortable: true,
            width: "10%",
            render: (record: RefreshToken) => ({
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
            render: (record: RefreshToken) => {
                // Define action items here
                const actionItems: ActionItem[] = [];
                
                // Add Revoke action if not already revoked
                if (!record.isRevoked) {
                    actionItems.push({
                        label: "Revoke",
                        icon: BanIcon,
                        onClick: () => confirmRevoke(record)
                    });
                }
                
                // Add Revoke All for User action
                actionItems.push({
                    label: "Revoke All for User",
                    icon: UserX,
                    onClick: () => confirmRevokeAllForUser(record)
                });
                
                // Add Revoke All for Account action
                actionItems.push({
                    label: "Revoke All for Account",
                    icon: Building,
                    onClick: () => confirmRevokeAllForAccount(record)
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
</script>

<div class="space-y-4">
    <!-- Delete Confirmation Dialog -->
    <RecordDeleteDialog
        state={deleteState}
        actionName="deleteToken"
        onConfirm={() => {
            // Refresh the page to update the tokens list
            window.location.reload();
        }}
    />
    
    <!-- Revoke Confirmation Dialog -->
    <RecordUpdateDialog
        state={revokeState}
        title="Revoke Refresh Token"
        description="Are you sure you want to revoke this token? This will invalidate the token and force the user to log in again."
        actionName="revokeToken"
        buttonText="Revoke Token"
        onConfirm={() => {
            // Refresh the page to update the tokens list
            window.location.reload();
        }}
    />
    
    <!-- Revoke All for User Confirmation Dialog -->
    <RecordUpdateDialog
        state={revokeUserState}
        title="Revoke All Tokens for User"
        description={`Are you sure you want to revoke all tokens for user ${revokeUserState.selectedRecord?.user?.name || 'this user'}? This will invalidate all tokens and force the user to log in again on all devices.`}
        actionName="revokeAllForUser"
        buttonText="Revoke All User Tokens"
        extraParams={{ userId: revokeUserState.selectedRecord?.user?.id }}
        onConfirm={() => {
            // Refresh the page to update the tokens list
            window.location.reload();
        }}
    />
    
    <!-- Revoke All for Account Confirmation Dialog -->
    <RecordUpdateDialog
        state={revokeAccountState}
        title="Revoke All Tokens for Account"
        description={`Are you sure you want to revoke all tokens for account ${revokeAccountState.selectedRecord?.account?.name || 'this account'}? This will invalidate all tokens and force all users to log in again.`}
        actionName="revokeAllForAccount"
        buttonText="Revoke All Account Tokens"
        extraParams={{ accountId: revokeAccountState.selectedRecord?.account?.id }}
        onConfirm={() => {
            // Refresh the page to update the tokens list
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
                    placeholder="Search by ID, device ID, or IP..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Account filter -->
            {#if props.filters.accounts && props.filters.accounts.length > 0}
                <PopoverFilter
                    label="Account"
                    options={props.filters.accounts.map(account => ({ 
                        label: account.name, 
                        value: account.id 
                    }))}
                    selectedValues={props.filters.accountId ? [props.filters.accountId] : []}
                    key="accountId"
                    singleSelect={true}
                />
            {/if}
            
            <!-- User filter -->
            {#if props.filters.users && props.filters.users.length > 0}
                <PopoverFilter
                    label="User"
                    options={props.filters.users.map(user => ({ 
                        label: user.name ? `${user.name} (${user.email})` : user.email, 
                        value: user.id 
                    }))}
                    selectedValues={props.filters.userId ? [props.filters.userId] : []}
                    key="userId"
                    singleSelect={true}
                />
            {/if}
            
            <!-- Revoked status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: 'Active', value: 'false' },
                    { label: 'Revoked', value: 'true' }
                ]}
                selectedValues={props.filters.isRevoked ? props.filters.isRevoked.split(',') : []}
                key="isRevoked"
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
