<script lang="ts">
    // Import components and dependencies
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RecordActions, { type ActionItem } from "$lib/components/ui_components_sveltekit/table/column/RecordActions.svelte";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Trash, Info } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    // Define the TokenUsageLog type
    interface TokenUsageLog {
        id: string;
        tokenId: string | null;
        tokenType: string;
        action: string;
        ipAddress: string | null;
        userAgent: string | null;
        success: boolean;
        error: string | null;
        createdAt: string;
        account: {
            id: string;
            name: string;
        } | null;
        user: {
            id: string;
            name: string | null;
            email: string;
        } | null;
    }

    // Props for DataTable component
    export let props = {
        records: [] as TokenUsageLog[],
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
            tokenTypeOptions: [] as { id: string, name: string }[],
            actionOptions: [] as { id: string, name: string }[],
            tokenTypes: [] as string[],
            actions: [] as string[],
            success: '',
            accountId: '',
            userId: '',
            startDate: '',
            endDate: ''
        }
    };
    
    // State for confirmation dialogs
    let deleteState = {
        selectedRecord: null as TokenUsageLog | null,
        confirmationOpen: false
    };

    let detailsState = {
        selectedRecord: null as TokenUsageLog | null,
        open: false
    };
    
    // Functions to open confirmation dialogs
    function confirmDelete(log: TokenUsageLog) {
        deleteState.selectedRecord = log;
        deleteState.confirmationOpen = true;
    }

    function showDetails(log: TokenUsageLog) {
        detailsState.selectedRecord = log;
        detailsState.open = true;
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

<!-- Column definitions for the token logs table -->
<script lang="ts" context="module">
    import { Badge } from "$lib/components/ui/badge";
    import StatusBadge from "$lib/components/ui_components_sveltekit/display/StatusBadge.svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    
    // Define columns for the token logs table
    const columns = [
        {
            id: "id",
            label: "Log ID",
            sortable: true,
            width: "10%",
            render: (record: TokenUsageLog) => ({
                component: Badge,
                props: {
                    variant: "outline",
                    class: "font-mono text-xs"
                },
                children: record.id.substring(0, 8) + "..."
            })
        },
        {
            id: "tokenType",
            label: "Token Type",
            sortable: true,
            width: "10%",
            render: (record: TokenUsageLog) => ({
                component: Badge,
                props: {
                    variant: "outline",
                    class: getTokenTypeBadgeClass(record.tokenType)
                },
                children: record.tokenType
            })
        },
        {
            id: "action",
            label: "Action",
            sortable: true,
            width: "10%",
            render: (record: TokenUsageLog) => ({
                component: Badge,
                props: {
                    variant: "outline",
                    class: getActionBadgeClass(record.action)
                },
                children: record.action
            })
        },
        {
            id: "user",
            label: "User",
            sortable: false,
            width: "15%",
            render: (record: TokenUsageLog) => 
                record.user 
                    ? `${record.user.name || 'Unknown'} (${record.user.email})` 
                    : 'N/A'
        },
        {
            id: "account",
            label: "Account",
            sortable: false,
            width: "10%",
            render: (record: TokenUsageLog) => 
                record.account 
                    ? record.account.name 
                    : 'N/A'
        },
        {
            id: "ipAddress",
            label: "IP Address",
            width: "10%",
            render: (record: TokenUsageLog) => record.ipAddress || 'N/A'
        },
        {
            id: "status",
            label: "Status",
            width: "10%",
            render: (record: TokenUsageLog) => ({
                component: StatusBadge,
                props: {
                    status: record.success ? "SUCCESS" : "FAILED"
                }
            })
        },
        {
            id: "createdAt",
            label: "Timestamp",
            sortable: true,
            width: "15%",
            render: (record: TokenUsageLog) => ({
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
            render: (record: TokenUsageLog) => {
                // Define action items here
                const actionItems: ActionItem[] = [
                    {
                        label: "View Details",
                        icon: Info,
                        onClick: () => showDetails(record)
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

    // Helper function to get badge class based on token type
    function getTokenTypeBadgeClass(tokenType: string): string {
        switch (tokenType) {
            case 'access':
                return 'bg-blue-50 text-blue-800 border-blue-200';
            case 'refresh':
                return 'bg-green-50 text-green-800 border-green-200';
            case 'api_key':
                return 'bg-purple-50 text-purple-800 border-purple-200';
            default:
                return 'bg-gray-50 text-gray-800 border-gray-200';
        }
    }
    
    // Helper function to get badge class based on action
    function getActionBadgeClass(action: string): string {
        switch (action) {
            case 'issue':
                return 'bg-green-50 text-green-800 border-green-200';
            case 'refresh':
                return 'bg-blue-50 text-blue-800 border-blue-200';
            case 'revoke':
                return 'bg-red-50 text-red-800 border-red-200';
            case 'use':
                return 'bg-yellow-50 text-yellow-800 border-yellow-200';
            case 'rotate':
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
        actionName="deleteLog"
        onConfirm={() => {
            // Refresh the page to update the logs list
            window.location.reload();
        }}
    />
    
    <!-- Details Dialog -->
    <Dialog.Root bind:open={detailsState.open}>
        <Dialog.Content class="max-w-2xl">
            <Dialog.Header>
                <Dialog.Title>Token Log Details</Dialog.Title>
                <Dialog.Description>
                    Detailed information about this token operation
                </Dialog.Description>
            </Dialog.Header>
            
            {#if detailsState.selectedRecord}
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <div>
                            <h4 class="text-sm font-medium">Log ID</h4>
                            <p class="text-sm text-muted-foreground font-mono">{detailsState.selectedRecord.id}</p>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">Token ID</h4>
                            <p class="text-sm text-muted-foreground font-mono">
                                {detailsState.selectedRecord.tokenId || 'N/A'}
                            </p>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">Token Type</h4>
                            <div>
                                <Badge variant="outline" class={getTokenTypeBadgeClass(detailsState.selectedRecord.tokenType)}>
                                    {detailsState.selectedRecord.tokenType}
                                </Badge>
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">Action</h4>
                            <div>
                                <Badge variant="outline" class={getActionBadgeClass(detailsState.selectedRecord.action)}>
                                    {detailsState.selectedRecord.action}
                                </Badge>
                            </div>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">Status</h4>
                            <StatusBadge status={detailsState.selectedRecord.success ? "SUCCESS" : "FAILED"} />
                        </div>
                    </div>
                    
                    <div class="space-y-2">
                        <div>
                            <h4 class="text-sm font-medium">User</h4>
                            <p class="text-sm text-muted-foreground">
                                {#if detailsState.selectedRecord.user}
                                    {detailsState.selectedRecord.user.name || 'Unknown'} ({detailsState.selectedRecord.user.email})
                                {:else}
                                    N/A
                                {/if}
                            </p>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">Account</h4>
                            <p class="text-sm text-muted-foreground">
                                {#if detailsState.selectedRecord.account}
                                    {detailsState.selectedRecord.account.name}
                                {:else}
                                    N/A
                                {/if}
                            </p>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">IP Address</h4>
                            <p class="text-sm text-muted-foreground">
                                {detailsState.selectedRecord.ipAddress || 'N/A'}
                            </p>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">User Agent</h4>
                            <p class="text-sm text-muted-foreground truncate max-w-xs" title={detailsState.selectedRecord.userAgent || ''}>
                                {detailsState.selectedRecord.userAgent || 'N/A'}
                            </p>
                        </div>
                        
                        <div>
                            <h4 class="text-sm font-medium">Timestamp</h4>
                            <p class="text-sm text-muted-foreground">
                                {new Date(detailsState.selectedRecord.createdAt).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                
                {#if detailsState.selectedRecord.error}
                    <div class="mt-4">
                        <h4 class="text-sm font-medium">Error</h4>
                        <div class="bg-red-50 border border-red-200 rounded-md p-2 mt-1">
                            <p class="text-sm text-red-800 whitespace-pre-wrap">{detailsState.selectedRecord.error}</p>
                        </div>
                    </div>
                {/if}
            {/if}
            
            <Dialog.Footer>
                <Dialog.Close asChild>
                    <button class="btn">Close</button>
                </Dialog.Close>
            </Dialog.Footer>
        </Dialog.Content>
    </Dialog.Root>

    {#if props.loading}
        <LoadingSkeleton />
    {:else}
        <div class="flex items-center gap-2 flex-wrap">
            <!-- Search filter -->
            <div class="w-1/3">
                <DebouncedTextFilter
                    placeholder="Search by ID, token ID, or IP..."
                    paramName="search"
                    value={$page.url.searchParams.get('search') || ''}
                />
            </div>
            
            <!-- Token type filter -->
            <PopoverFilter
                label="Token Type"
                options={props.filters.tokenTypeOptions?.map(type => ({ label: type.name, value: type.id })) || []}
                selectedValues={props.filters.tokenTypes || []}
                key="tokenTypes"
            />
            
            <!-- Action filter -->
            <PopoverFilter
                label="Action"
                options={props.filters.actionOptions?.map(action => ({ label: action.name, value: action.id })) || []}
                selectedValues={props.filters.actions || []}
                key="actions"
            />
            
            <!-- Success status filter -->
            <PopoverFilter
                label="Status"
                options={[
                    { label: 'Success', value: 'true' },
                    { label: 'Failed', value: 'false' }
                ]}
                selectedValues={props.filters.success ? props.filters.success.split(',') : []}
                key="success"
                singleSelect={false}
            />
            
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
            
            <!-- Date filters -->
            <div class="flex items-center gap-2">
                <div class="w-32">
                    <label for="startDate" class="text-xs font-medium">From Date</label>
                    <input 
                        type="date" 
                        id="startDate"
                        name="startDate"
                        class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                        value={props.filters.startDate}
                        on:change={(e) => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('startDate', e.currentTarget.value);
                            goto(url.toString());
                        }}
                    />
                </div>
                <div class="w-32">
                    <label for="endDate" class="text-xs font-medium">To Date</label>
                    <input 
                        type="date" 
                        id="endDate"
                        name="endDate"
                        class="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                        value={props.filters.endDate}
                        on:change={(e) => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('endDate', e.currentTarget.value);
                            goto(url.toString());
                        }}
                    />
                </div>
            </div>
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
