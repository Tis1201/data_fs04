<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import DataTable from "$lib/components/ui_components_sveltekit/table/DataTable.svelte";
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import DateRangeFilter from "$lib/components/ui_components_sveltekit/table/filter/DateRangeFilter.svelte";
    import SearchableFormSelect from "$lib/components/ui_components_sveltekit/form/SearchableFormSelect.svelte";
    import { FileText } from "lucide-svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
    import { Separator } from "$lib/components/ui/separator";
    import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "$lib/components/ui/accordion";
    import ViewButton from "$lib/components/audit-log/ViewButton.svelte";
    import type { TableColumn } from "$lib/components/ui_components_sveltekit/table/types";
    import { writable } from "svelte/store";
    
    export let data;
    
    // Modal state
    let showDetailModal = false;
    let selectedAuditLog: any = null;
    
    // Filter state from URL
    $: accountId = $page.url.searchParams.get('accountId') || '';
    $: userId = $page.url.searchParams.get('userId') || '';
    $: actionTypes = $page.url.searchParams.get('actionType')?.split(',').filter(Boolean) || [];
    $: tableNames = $page.url.searchParams.get('tableName')?.split(',').filter(Boolean) || [];
    
    // Store for selected values
    const selectedActionTypes = writable(actionTypes);
    const selectedTableNames = writable(tableNames);
    
    // Update stores when URL changes
    $: selectedActionTypes.set(actionTypes);
    $: selectedTableNames.set(tableNames);
    
    // Account options
    $: accountOptions = [
        { label: 'All Accounts', value: '' },
        ...(data.accounts || []).map((a: any) => ({ label: a.name, value: a.id }))
    ];
    
    // User options (filtered by account if selected)
    $: userOptions = [
        { label: 'All Users', value: '' },
        ...(data.users || []).map((u: any) => ({ 
            label: u.name || u.email, 
            value: u.id 
        }))
    ];
    
    // Action type options
    const actionTypeOptions = [
        { label: 'Insert', value: 'INSERT' },
        { label: 'Update', value: 'UPDATE' },
        { label: 'Delete', value: 'DELETE' }
    ];
    
    // Table name options
    $: tableNameOptions = (data.tableNames || []).map((name: string) => ({
        label: name,
        value: name
    }));
    
    // Handle account change - update user filter
    function handleAccountChange(event: CustomEvent<string>) {
        const value = event.detail;
        const url = new URL(window.location.href);
        if (value) {
            url.searchParams.set('accountId', value);
        } else {
            url.searchParams.delete('accountId');
        }
        // Reset user filter when account changes
        url.searchParams.delete('userId');
        url.searchParams.set('page', '1');
        goto(url.toString(), { replaceState: true, noScroll: true });
    }
    
    // Handle user change
    function handleUserChange(event: CustomEvent<string>) {
        const value = event.detail;
        const url = new URL(window.location.href);
        if (value) {
            url.searchParams.set('userId', value);
        } else {
            url.searchParams.delete('userId');
        }
        url.searchParams.set('page', '1');
        goto(url.toString(), { replaceState: true, noScroll: true });
    }
    
    const title = "Audit Logs";
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Debug"],
        ["Audit Logs"]
    ];
    
    // Table props
    $: props = {
        records: data.auditLogs || [],
        pagination: {
            page: data.page,
            per_page: data.pageSize,
            total_records: data.total,
            total_pages: Math.ceil(data.total / data.pageSize)
        },
        sort: {
            field: 'timestamp',
            order: 'desc'
        },
        loading: false
    };
    
    // Helper function to get action type styling
    function getActionTypeClass(actionType: string): string {
        switch (actionType) {
            case 'INSERT':
                return 'text-green-600 font-semibold';
            case 'UPDATE':
                return 'text-blue-600 font-semibold';
            case 'DELETE':
                return 'text-red-600 font-semibold';
            default:
                return 'text-muted-foreground';
        }
    }
    
    // Format change summary for display
    function formatChangeSummary(record: any): string {
        if (!record.changeSummary) return 'No changes';
        
        // For DELETE actions, show simpler message
        if (record.actionType === 'DELETE') {
            return `Deleted ${record.tableName} record`;
        }
        
        // Truncate long summaries
        const maxLength = 80;
        if (record.changeSummary.length > maxLength) {
            return record.changeSummary.substring(0, maxLength) + '...';
        }
        
        return record.changeSummary;
    }
    
    // Column definitions
    const columns: TableColumn[] = [
        {
            id: 'timestamp',
            label: 'Timestamp',
            sortable: true,
            field: 'timestamp',
            width: '15%',
            render: (record: any) => ({
                component: RelativeDate,
                props: {
                    date: record.timestamp,
                    format: 'relative',
                    showTooltip: true,
                    useHoverCard: true
                }
            })
        },
        {
            id: 'user',
            label: 'User',
            sortable: true,
            field: 'user.email',
            width: '15%',
            render: (record: any) => record.user?.name || record.user?.email || 'Unknown'
        },
        {
            id: 'actionType',
            label: 'Action',
            sortable: true,
            field: 'actionType',
            width: '10%',
            render: (record: any) => `<span class="${getActionTypeClass(record.actionType)}">${record.actionType || 'N/A'}</span>`
        },
        {
            id: 'tableName',
            label: 'Table',
            sortable: true,
            field: 'tableName',
            width: '12%',
            render: (record: any) => record.tableName
        },
        {
            id: 'recordId',
            label: 'Record ID',
            sortable: false,
            width: '15%',
            render: (record: any) => record.recordId ? `<code class="text-xs font-mono bg-muted px-1 py-0.5 rounded">${record.recordId}</code>` : 'N/A'
        },
        {
            id: 'changeSummary',
            label: 'Summary',
            sortable: false,
            width: '20%',
            render: (record: any) => {
                const summary = formatChangeSummary(record);
                const fullSummary = record.changeSummary || 'No changes';
                return `<span class="text-sm" title="${fullSummary.replace(/"/g, '&quot;')}">${summary}</span>`;
            }
        },
        {
            id: 'ipAddress',
            label: 'IP Address',
            sortable: true,
            field: 'ipAddress',
            width: '10%',
            render: (record: any) => record.ipAddress || 'N/A'
        },
        {
            id: 'actions',
            label: 'Actions',
            sortable: false,
            width: '8%',
            render: (record: any) => ({
                component: ViewButton,
                props: {
                    record: record,
                    onView: () => openDetailModal(record)
                }
            })
        }
    ];
    
    // Open detail modal
    function openDetailModal(auditLog: any) {
        selectedAuditLog = auditLog;
        showDetailModal = true;
    }
    
    // Format JSON for display
    function formatJSON(data: any): string {
        if (!data) return 'null';
        try {
            return JSON.stringify(data, null, 2);
        } catch (e) {
            return String(data);
        }
    }
    
</script>

<AdminPageLayout {title} crumbs={pageCrumbs} compact={true} contentSpacing="space-y-4">
    <AdminCard
        title="Audit Logs"
        description="View and filter system audit logs"
        icon={FileText}
        compact={true}
    >
        <div class="space-y-4">
            <!-- Filters -->
            <div class="flex flex-wrap items-center gap-2">
                <!-- Account Filter -->
                <div class="w-64">
                    <SearchableFormSelect
                        value={accountId}
                        options={accountOptions}
                        placeholder="All Accounts"
                        on:change={handleAccountChange}
                    />
                </div>
                
                <!-- User Filter -->
                <div class="w-64">
                    <SearchableFormSelect
                        value={userId}
                        options={userOptions}
                        placeholder="All Users"
                        on:change={handleUserChange}
                    />
                </div>
                
                <!-- Action Type Filter -->
                <PopoverFilter
                    label="Action Type"
                    options={actionTypeOptions}
                    selectedValues={$selectedActionTypes}
                    key="actionType"
                />
                
                <!-- Table Name Filter -->
                <PopoverFilter
                    label="Table"
                    options={tableNameOptions}
                    selectedValues={$selectedTableNames}
                    key="tableName"
                    searchable={true}
                />
                
                <!-- Date Range Filter -->
                <DateRangeFilter
                    label="Date Range"
                    startParamName="startDate"
                    endParamName="endDate"
                    format_string="yyyy-MM-dd'T'HH:mm:ss"
                />
                
                <!-- Search -->
                <div class="flex-1 min-w-[200px]">
                    <DebouncedTextFilter
                        placeholder="Search by summary, record ID..."
                        paramName="search"
                        value={$page.url.searchParams.get('search') || ''}
                    />
                </div>
            </div>
            
            {#if data.loading}
                <LoadingSkeleton />
            {:else if data.auditLogs.length === 0}
                <div class="text-center py-8 text-muted-foreground">
                    <p>No audit logs found</p>
                    {#if accountId || userId || actionTypes.length > 0 || tableNames.length > 0}
                        <p class="text-sm mt-2">Try adjusting your filters</p>
                    {/if}
                </div>
            {:else}
                <DataTable
                    {columns}
                    {props}
                    on:sort={handleTableSort}
                    on:pagination={handleTablePagination}
                />
            {/if}
        </div>
    </AdminCard>
    
    <!-- Detail Modal -->
    <Dialog bind:open={showDetailModal}>
        <DialogContent class="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Audit Log Details</DialogTitle>
                <DialogDescription>
                    Complete information about this audit log entry
                </DialogDescription>
            </DialogHeader>
            
            {#if selectedAuditLog}
                <div class="space-y-6 py-4">
                    <!-- Metadata Section -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="text-sm font-medium text-muted-foreground">User</label>
                            <p class="text-sm">{selectedAuditLog.user?.name || selectedAuditLog.user?.email || 'Unknown'}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-muted-foreground">Action Type</label>
                            <div>
                                <span class={getActionTypeClass(selectedAuditLog.actionType)}>
                                    {selectedAuditLog.actionType}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-muted-foreground">Timestamp</label>
                            <div>
                                <RelativeDate 
                                    date={selectedAuditLog.timestamp} 
                                    format="relative"
                                    showTooltip={true}
                                />
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-muted-foreground">IP Address</label>
                            <p class="text-sm font-mono">{selectedAuditLog.ipAddress || 'N/A'}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-muted-foreground">Table</label>
                            <p class="text-sm">{selectedAuditLog.tableName}</p>
                        </div>
                        <div>
                            <label class="text-sm font-medium text-muted-foreground">Record ID</label>
                            <p class="text-sm font-mono">{selectedAuditLog.recordId}</p>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    <!-- Change Summary -->
                    {#if selectedAuditLog.changeSummary}
                        <div>
                            <label class="text-sm font-medium text-muted-foreground mb-2 block">Change Summary</label>
                            {#if selectedAuditLog.actionType === 'DELETE'}
                                <div class="text-sm bg-red-50 border border-red-200 p-3 rounded-md">
                                    <p class="text-red-800 font-medium">Record Deleted</p>
                                    <p class="text-xs text-red-600 mt-1">This record was permanently deleted from the system.</p>
                                </div>
                            {:else}
                                <div class="text-sm bg-muted p-3 rounded-md max-h-48 overflow-y-auto">
                                    <div class="space-y-1">
                                        {#each selectedAuditLog.changeSummary.split(', ') as change}
                                            <div class="flex items-start gap-2">
                                                <span class="text-muted-foreground">•</span>
                                                <span class="flex-1">{change}</span>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}
                    
                    <!-- JSON Data -->
                    <Accordion type="single" collapsible class="w-full">
                        {#if selectedAuditLog.oldData}
                            <AccordionItem value="oldData">
                                <AccordionTrigger>Old Data</AccordionTrigger>
                                <AccordionContent>
                                    <pre class="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto max-h-96 overflow-y-auto">{formatJSON(selectedAuditLog.oldData)}</pre>
                                </AccordionContent>
                            </AccordionItem>
                        {/if}
                        
                        {#if selectedAuditLog.newData}
                            <AccordionItem value="newData">
                                <AccordionTrigger>New Data</AccordionTrigger>
                                <AccordionContent>
                                    <pre class="text-xs font-mono bg-muted p-4 rounded-md overflow-x-auto max-h-96 overflow-y-auto">{formatJSON(selectedAuditLog.newData)}</pre>
                                </AccordionContent>
                            </AccordionItem>
                        {/if}
                    </Accordion>
                </div>
            {/if}
        </DialogContent>
    </Dialog>
</AdminPageLayout>

