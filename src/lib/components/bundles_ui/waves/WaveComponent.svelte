<script lang="ts">
    import { Square, Loader2, Eye } from 'lucide-svelte';
    import { createEventDispatcher } from "svelte";
    import { enhance } from '$app/forms';
    import type { SubmitFunction } from '@sveltejs/kit';
    import { toast } from 'svelte-sonner';
    
    // Design System Components
    import { 
        Card, 
        Badge, 
        Button, 
        DataTable,
        ProgressBar
    } from '$lib/design-system/components';
    import type { ColumnDef, BadgeColor } from '$lib/design-system/components';
    
    // Types
    interface WaveData {
        id: string;
        name: string;
        status: string;
        startTime?: string | null;
        endTime?: string | null;
        progress?: number | null;
        devicesTotal?: number | null;
        devicesCompleted?: number | null;
        devicesFailed?: number | null;
    }
    
    // Props
    export let bundleId: string;
    export let loading = false;
    export let empty = false;
    export let selectedWaveId: string | null = null;
    export let waves: WaveData[] = [];
    export let enableStopWaves: boolean = true;
    
    // Event dispatcher
    const dispatch = createEventDispatcher();
    
    // State for stop all waves action
    let stoppingWaves = false;
    let wavesStopped = false;
    
    // Derive waves list to display
    $: displayWaves = Array.isArray(waves) && waves.length > 0 ? waves : [];
    
    // Check if any waves are in progress or pending
    $: hasActiveWaves = displayWaves.some(wave => 
        wave.status === 'IN_PROGRESS' || wave.status === 'PENDING'
    );
    
    // Check if any waves are cancelled (to hide button after stopping)
    $: hasCancelledWaves = displayWaves.some(wave => wave.status === 'CANCELLED');
    
    // Show button only if there are active waves, no waves have been stopped yet, and stop waves is enabled
    $: showStopButton = enableStopWaves && hasActiveWaves && !wavesStopped;
    
    // Statistics
    $: totalBatches = displayWaves.length;
    $: completedBatches = displayWaves.filter(w => w.status === 'COMPLETED').length;
    $: inProgressBatches = displayWaves.filter(w => w.status === 'IN_PROGRESS').length;
    $: failedBatches = displayWaves.filter(w => w.status === 'FAILED').length;
    $: cancelledBatches = displayWaves.filter(w => w.status === 'CANCELLED').length;
    
    // Get status badge color for design system
    function getStatusColor(status: string): BadgeColor {
        const colorMap: Record<string, BadgeColor> = {
            'COMPLETED': 'success',
            'IN_PROGRESS': 'blue',
            'PENDING': 'gray',
            'FAILED': 'error',
            'ROLLED_BACK': 'warning',
            'CANCELLED': 'rose'
        };
        return colorMap[status] || 'gray';
    }
    
    // Get status display text
    function getStatusDisplay(status: string): string {
        const statusMap: Record<string, string> = {
            'COMPLETED': 'Completed',
            'IN_PROGRESS': 'In Progress',
            'PENDING': 'Pending',
            'FAILED': 'Failed',
            'ROLLED_BACK': 'Rolled Back',
            'CANCELLED': 'Cancelled'
        };
        return statusMap[status] || status;
    }
    
    // Format devices display
    function formatDevices(wave: WaveData): string {
        const completed = wave.devicesCompleted ?? 0;
        const total = wave.devicesTotal ?? 0;
        const failed = wave.devicesFailed ?? 0;
        
        if (failed > 0) {
            return `${completed}/${total} (${failed} failed)`;
        }
        return `${completed}/${total}`;
    }
    
    // DataTable columns configuration
    const columns: ColumnDef<WaveData>[] = [
        {
            id: 'name',
            header: 'Batch Name',
            accessor: 'name',
            type: 'text',
            sortable: true
        },
        {
            id: 'status',
            header: 'Status',
            accessor: 'status',
            type: 'badge',
            sortable: true,
            statusColor: (value) => getStatusColor(value),
            showDot: () => true
        },
        {
            id: 'devices',
            header: 'Devices',
            accessor: (row) => formatDevices(row),
            type: 'text',
            sortable: false
        },
        {
            id: 'progress',
            header: 'Progress',
            accessor: 'progress',
            type: 'progress',
            progressField: 'progress',
            showProgressValue: true,
            sortable: true
        },
        {
            id: 'startTime',
            header: 'Start Time',
            accessor: 'startTime',
            type: 'datetime',
            sortable: true
        },
        {
            id: 'endTime',
            header: 'End Time',
            accessor: 'endTime',
            type: 'datetime',
            sortable: true
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'actions',
            align: 'right',
            actions: [
                {
                    id: 'view',
                    label: 'View',
                    icon: Eye,
                    variant: 'text',
                    color: 'primary',
                    onClick: (row) => selectWave(row.id)
                }
            ]
        }
    ];
    
    function stopAllWaves() {
        stoppingWaves = true;
        console.log(`Stop all waves for bundle ${bundleId}`);
        
        // Create a form and submit it to call the server action
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '?/stopAllWaves';
        
        // Use enhance to handle the form submission
        const submitFn: SubmitFunction = () => {
            return async ({ result }) => {
                stoppingWaves = false;
                if (result.type === 'success') {
                    toast.success('Waves stopped successfully', {
                        description: (result.data as any)?.message || 'Pending waves have been cancelled'
                    });
                    dispatch('wavesStopped', { bundleId });
                    wavesStopped = true;
                } else if (result.type === 'failure') {
                    const errorMessage = (result.data as any)?.message || (result.data as any)?.error || 'Failed to stop waves';
                    toast.error('Failed to stop waves', {
                        description: errorMessage
                    });
                } else if (result.type === 'error') {
                    toast.error('Network error', {
                        description: 'Failed to connect to server. Please try again.'
                    });
                }
            };
        };
        
        const { destroy } = enhance(form, submitFn);
        
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        destroy();
    }
    
    // Select a wave and emit the event
    function selectWave(waveId: string) {
        selectedWaveId = waveId;
        const selectedWave = displayWaves.find((wave) => wave.id === waveId);
        dispatch('selectWave', { wave: selectedWave });
    }
    
    // Handle row click
    function handleRowClick(event: CustomEvent<{ row: WaveData }>) {
        selectWave(event.detail.row.id);
    }
</script>

<Card showHeader={true} padding="lg">
    <svelte:fragment slot="header">
        <div class="header-content">
            <div class="header-left">
                <h3 class="header-title">Deployment Batches</h3>
                <p class="header-subtitle">Manage deployment batches for this bundle</p>
            </div>
            {#if showStopButton}
                <Button 
                    variant="outline" 
                    color="danger"
                    size="md"
                    on:click={stopAllWaves}
                    disabled={stoppingWaves}
                >
                    {#if stoppingWaves}
                        <Loader2 size={16} class="animate-spin" slot="icon-left" />
                        Stopping...
                    {:else}
                        <Square size={16} slot="icon-left" />
                        Stop All Batches
                    {/if}
                </Button>
            {/if}
        </div>
    </svelte:fragment>

    {#if loading}
        <div class="loading-state">
            <Loader2 size={24} class="animate-spin" />
            <span>Loading batches...</span>
        </div>
    {:else if empty || displayWaves.length === 0}
        <div class="empty-state">
            <p class="empty-title">No batches created</p>
            <p class="empty-desc">Batches will be created when this bundle is published</p>
        </div>
    {:else}
        <div class="content-wrapper">
            <!-- Summary metrics -->
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-value">{totalBatches}</span>
                    <span class="stat-label">Total Batches</span>
                </div>
                <div class="stat-card success">
                    <span class="stat-value">{completedBatches}</span>
                    <span class="stat-label">Completed</span>
                </div>
                <div class="stat-card primary">
                    <span class="stat-value">{inProgressBatches}</span>
                    <span class="stat-label">In Progress</span>
                </div>
                <div class="stat-card error">
                    <span class="stat-value">{failedBatches}</span>
                    <span class="stat-label">Failed</span>
                </div>
                <div class="stat-card warning">
                    <span class="stat-value">{cancelledBatches}</span>
                    <span class="stat-label">Cancelled</span>
                </div>
            </div>
            
            <!-- Batches table -->
            <DataTable
                data={displayWaves}
                {columns}
                paginated={displayWaves.length > 10}
                selectable={false}
                hoverable={true}
                striped={false}
                on:rowClick={handleRowClick}
            />
        </div>
    {/if}
    
    <svelte:fragment slot="footer">
        <div class="footer-content">
            <p>Batches are created automatically when a bundle is published and cannot be modified afterward.</p>
            <p>Each batch represents a group of devices that will receive the bundle update.</p>
            {#if enableStopWaves}
                {#if hasCancelledWaves}
                    <p class="footer-warning">Some batches have been cancelled. The deployment process has been stopped.</p>
                {:else if hasActiveWaves}
                    <p>Click "Stop All Batches" to prevent subsequent batches from starting after the current batch completes.</p>
                {:else}
                    <p>All batches have completed or been stopped. No further deployment actions are available.</p>
                {/if}
            {:else}
                <p>Monitor the deployment progress of your batches.</p>
            {/if}
        </div>
    </svelte:fragment>
</Card>

<style>
    .header-content {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-4);
        width: 100%;
    }
    
    .header-left {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }
    
    .header-title {
        font-size: var(--ds-text-lg);
        font-weight: var(--ds-font-semibold);
        color: var(--ds-text-primary);
        margin: 0;
    }
    
    .header-subtitle {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }
    
    .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--ds-space-3);
        padding: var(--ds-space-8);
        color: var(--ds-text-secondary);
    }
    
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-8);
        text-align: center;
    }
    
    .empty-title {
        font-size: var(--ds-text-lg);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
        margin: 0 0 var(--ds-space-2) 0;
    }
    
    .empty-desc {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }
    
    .content-wrapper {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-6);
    }
    
    /* Stats Grid */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: var(--ds-space-4);
    }
    
    @media (max-width: 1024px) {
        .stats-grid {
            grid-template-columns: repeat(3, 1fr);
        }
    }
    
    @media (max-width: 640px) {
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    
    .stat-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-4);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
        text-align: center;
    }
    
    .stat-value {
        font-size: var(--ds-text-2xl);
        font-weight: var(--ds-font-bold);
        color: var(--ds-text-primary);
        line-height: 1;
    }
    
    .stat-card.success .stat-value {
        color: var(--ds-color-success-500);
    }
    
    .stat-card.primary .stat-value {
        color: var(--ds-color-primary-500);
    }
    
    .stat-card.error .stat-value {
        color: var(--ds-color-error-500);
    }
    
    .stat-card.warning .stat-value {
        color: var(--ds-color-warning-500);
    }
    
    .stat-label {
        font-size: var(--ds-text-xs);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-secondary);
        text-transform: uppercase;
        margin-top: var(--ds-space-1);
    }
    
    /* Footer */
    .footer-content {
        font-size: var(--ds-text-xs);
        color: var(--ds-text-secondary);
    }
    
    .footer-content p {
        margin: 0 0 var(--ds-space-1) 0;
    }
    
    .footer-content p:last-child {
        margin-bottom: 0;
    }
    
    .footer-warning {
        color: var(--ds-color-warning-500);
        font-weight: var(--ds-font-medium);
    }
    
    /* Animations */
    :global(.animate-spin) {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
