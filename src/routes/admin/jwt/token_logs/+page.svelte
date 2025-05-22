<script lang="ts">
    import { Trash2 } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import TokenLogsTable from "./table.svelte";
    import TokenLogsMetrics from "./metrics.svelte";
    import type { PageData } from "./$types";
    
    // Import page data from server
    export let data: PageData;
    
    // Create props for the token logs table
    $: tableProps = {
        records: data.tokenLogs || [],
        pagination: {
            page: data.meta?.currentPage || 1,
            per_page: data.meta?.itemsPerPage || 10,
            total_records: data.meta?.totalItems || 0,
            total_pages: data.meta?.totalPages || 0
        },
        sort: {
            field: data.sort?.field || "createdAt",
            order: data.sort?.order || "desc"
        },
        loading: false,
        filters: {
            accounts: data.accounts || [],
            users: data.users || [],
            tokenTypeOptions: data.tokenTypeOptions || [],
            actionOptions: data.actionOptions || [],
            tokenTypes: data.filters?.tokenTypes || [],
            actions: data.filters?.actions || [],
            success: data.filters?.success || '',
            accountId: data.filters?.accountId || '',
            userId: data.filters?.userId || '',
            startDate: data.filters?.startDate || '',
            endDate: data.filters?.endDate || ''
        }
    };
    
    // Create props for the metrics component
    $: metricsProps = {
        metrics: data.metrics || {
            total: 0,
            success: 0,
            failure: 0,
            last24Hours: 0,
            lastWeek: 0,
            lastMonth: 0,
            tokenTypeDistribution: [],
            actionDistribution: []
        }
    };
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["JWT", "/admin/jwt"],
        "Token Logs"
    ];
</script>

<AdminPageLayout
    title="JWT Token Logs"
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Clear Old Logs",
            icon: Trash2,
            onClick: () => document.getElementById('clear-logs-dialog')?.showModal()
        }
    ]}
>
    <!-- Metrics Dashboard -->
    <div class="mb-6">
        <TokenLogsMetrics props={metricsProps} />
    </div>
    
    <!-- Token Logs Table -->
    <TokenLogsTable props={tableProps} />
    
    <!-- Clear Logs Dialog -->
    <dialog id="clear-logs-dialog" class="modal">
        <div class="modal-box">
            <h3 class="font-bold text-lg">Clear Old Token Logs</h3>
            <p class="py-4">This will permanently delete token logs older than the specified number of days. This action cannot be undone.</p>
            
            <form method="POST" action="?/clearLogs" class="space-y-4">
                <div class="form-control">
                    <label class="label">
                        <span class="label-text">Delete logs older than (days)</span>
                    </label>
                    <input type="number" name="olderThan" class="input input-bordered" min="1" value="30" />
                </div>
                
                <div class="modal-action">
                    <button type="button" class="btn" onclick="document.getElementById('clear-logs-dialog').close()">Cancel</button>
                    <button type="submit" class="btn btn-error">Clear Logs</button>
                </div>
            </form>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button>close</button>
        </form>
    </dialog>
</AdminPageLayout>
