<script lang="ts">
    /**
     * DeploymentStatusCard - Displays deployment progress overview
     * Shows overall progress, wave statistics, and deployment status
     */
    import { createEventDispatcher } from 'svelte';
    import { 
        CheckCircle2, 
        Clock, 
        AlertTriangle, 
        XCircle, 
        Loader2,
        Play,
        Pause,
        Square
    } from 'lucide-svelte';
    
    // Design System
    import { Card, Badge, ProgressBar, Button } from '$lib/design-system/components';
    import {
        getBundleStatusLabel,
        getBundleStatusBadgeColor
    } from '$lib/utils/bundleUtils';

    // Types
    interface WaveData {
        id: string;
        name: string;
        status: string;
        devicesTotal?: number | null;
        devicesCompleted?: number | null;
        devicesFailed?: number | null;
        progress?: number | null;
    }

    // Props
    export let bundle: {
        id: string;
        name: string;
        status: string;
        scheduledAt?: string | null;
        waves?: WaveData[];
    };
    export let waves: WaveData[] = [];
    export let loading: boolean = false;
    export let showStopButton: boolean = false;
    export let stoppingWaves: boolean = false;

    // Event dispatcher
    const dispatch = createEventDispatcher<{
        stopAllWaves: void;
        viewWaves: void;
    }>();

    // Computed values
    $: displayWaves = waves.length > 0 ? waves : (bundle?.waves || []);
    
    // Calculate overall statistics
    $: totalDevices = displayWaves.reduce((sum, w) => sum + (w.devicesTotal || 0), 0);
    $: completedDevices = displayWaves.reduce((sum, w) => sum + (w.devicesCompleted || 0), 0);
    $: failedDevices = displayWaves.reduce((sum, w) => sum + (w.devicesFailed || 0), 0);
    $: pendingDevices = totalDevices - completedDevices - failedDevices;
    
    // Calculate overall progress
    $: overallProgress = totalDevices > 0 
        ? Math.round(((completedDevices + failedDevices) / totalDevices) * 100) 
        : 0;
    
    // Wave statistics
    $: totalWaves = displayWaves.length;
    $: completedWaves = displayWaves.filter(w => w.status === 'COMPLETED').length;
    $: inProgressWaves = displayWaves.filter(w => w.status === 'IN_PROGRESS').length;
    $: pendingWaves = displayWaves.filter(w => w.status === 'PENDING').length;
    $: failedWaves = displayWaves.filter(w => w.status === 'FAILED').length;
    $: cancelledWaves = displayWaves.filter(w => w.status === 'CANCELLED').length;
    
    // Determine deployment phase
    $: deploymentPhase = getDeploymentPhase(bundle.status, displayWaves);
    
    // Get progress bar color based on status
    $: progressColor = getProgressColor(bundle.status, failedDevices, totalDevices);
    
    function getDeploymentPhase(status: string, waves: WaveData[]): string {
        if (status === 'DRAFT') return 'Not Started';
        if (status === 'PUBLISHED' && waves.length === 0) return 'Scheduled';
        if (status === 'CANCELLED' || status === 'STOPPED') return 'Stopped';
        if (status === 'COMPLETED') return 'Completed';
        if (status === 'FAILED') return 'Failed';
        
        // Check wave statuses
        if (inProgressWaves > 0) return 'In Progress';
        if (pendingWaves > 0 && completedWaves > 0) return 'Partially Complete';
        if (pendingWaves > 0) return 'Queued';
        
        return 'Unknown';
    }
    
    function getProgressColor(status: string, failed: number, total: number): 'gray' | 'primary' | 'success' | 'warning' | 'error' {
        if (status === 'DRAFT') return 'gray';
        if (status === 'FAILED' || (failed > 0 && failed === total)) return 'error';
        if (status === 'COMPLETED' && failed === 0) return 'success';
        if (failed > 0) return 'warning';
        if (status === 'IN_PROGRESS' || inProgressWaves > 0) return 'primary';
        return 'gray';
    }
    
    function handleStopAllWaves() {
        dispatch('stopAllWaves');
    }
    
    function handleViewWaves() {
        dispatch('viewWaves');
    }
</script>

<Card showHeader={true} padding="lg">
    <svelte:fragment slot="header">
        <div class="header-content">
            <div class="header-left">
                <h3 class="header-title">Deployment Status</h3>
                <p class="header-subtitle">Overall deployment progress and statistics</p>
            </div>
            <div class="header-right">
                <Badge 
                    label={getBundleStatusLabel(bundle.status)} 
                    color={getBundleStatusBadgeColor(bundle.status, bundle)} 
                    showDot={true} 
                    size="md" 
                />
                {#if showStopButton && (inProgressWaves > 0 || pendingWaves > 0)}
                    <Button 
                        variant="outline" 
                        color="danger" 
                        size="sm"
                        on:click={handleStopAllWaves}
                        disabled={stoppingWaves}
                    >
                        {#if stoppingWaves}
                            <Loader2 size={16} class="animate-spin" slot="icon-left" />
                            Stopping...
                        {:else}
                            <Square size={16} slot="icon-left" />
                            Stop All
                        {/if}
                    </Button>
                {/if}
            </div>
        </div>
    </svelte:fragment>

    {#if loading}
        <div class="loading-state">
            <Loader2 size={24} class="animate-spin" />
            <span>Loading deployment status...</span>
        </div>
    {:else if bundle.status === 'DRAFT'}
        <div class="empty-state">
            <Clock size={48} class="empty-icon" />
            <p class="empty-title">Deployment Not Started</p>
            <p class="empty-desc">Publish this bundle to start the deployment process</p>
        </div>
    {:else if displayWaves.length === 0}
        <div class="empty-state">
            <Clock size={48} class="empty-icon" />
            <p class="empty-title">No Batches Created</p>
            <p class="empty-desc">Batches will be created when the bundle is published</p>
        </div>
    {:else}
        <div class="status-content">
            <!-- Overall Progress Section -->
            <div class="progress-section">
                <div class="progress-header">
                    <span class="progress-label">Overall Progress</span>
                    <span class="progress-value">{overallProgress}%</span>
                </div>
                <ProgressBar 
                    value={overallProgress} 
                    color={progressColor}
                    size="md"
                    showThumb={false}
                />
                <div class="progress-details">
                    <span class="progress-detail">
                        {completedDevices + failedDevices} of {totalDevices} devices processed
                    </span>
                    {#if failedDevices > 0}
                        <span class="progress-detail error">
                            ({failedDevices} failed)
                        </span>
                    {/if}
                </div>
            </div>

            <!-- Statistics Grid -->
            <div class="stats-grid">
                <!-- Device Statistics -->
                <div class="stat-card">
                    <div class="stat-icon success">
                        <CheckCircle2 size={20} />
                    </div>
                    <div class="stat-content">
                        <span class="stat-value">{completedDevices}</span>
                        <span class="stat-label">Completed</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon primary">
                        <Loader2 size={20} class="animate-spin-slow" />
                    </div>
                    <div class="stat-content">
                        <span class="stat-value">{pendingDevices > 0 ? pendingDevices : 0}</span>
                        <span class="stat-label">In Progress</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon warning">
                        <Clock size={20} />
                    </div>
                    <div class="stat-content">
                        <span class="stat-value">{pendingDevices}</span>
                        <span class="stat-label">Pending</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <div class="stat-icon error">
                        <XCircle size={20} />
                    </div>
                    <div class="stat-content">
                        <span class="stat-value">{failedDevices}</span>
                        <span class="stat-label">Failed</span>
                    </div>
                </div>
            </div>

            <!-- Wave Summary -->
            <div class="wave-summary">
                <div class="wave-summary-header">
                    <span class="wave-summary-title">Batch Summary</span>
                    <Button variant="text" color="primary" size="sm" on:click={handleViewWaves}>
                        View All Batches
                    </Button>
                </div>
                <div class="wave-stats">
                    <div class="wave-stat">
                        <span class="wave-stat-value">{totalWaves}</span>
                        <span class="wave-stat-label">Total</span>
                    </div>
                    <div class="wave-stat-divider"></div>
                    <div class="wave-stat success">
                        <span class="wave-stat-value">{completedWaves}</span>
                        <span class="wave-stat-label">Completed</span>
                    </div>
                    <div class="wave-stat-divider"></div>
                    <div class="wave-stat primary">
                        <span class="wave-stat-value">{inProgressWaves}</span>
                        <span class="wave-stat-label">In Progress</span>
                    </div>
                    <div class="wave-stat-divider"></div>
                    <div class="wave-stat warning">
                        <span class="wave-stat-value">{pendingWaves}</span>
                        <span class="wave-stat-label">Pending</span>
                    </div>
                    {#if failedWaves > 0}
                        <div class="wave-stat-divider"></div>
                        <div class="wave-stat error">
                            <span class="wave-stat-value">{failedWaves}</span>
                            <span class="wave-stat-label">Failed</span>
                        </div>
                    {/if}
                    {#if cancelledWaves > 0}
                        <div class="wave-stat-divider"></div>
                        <div class="wave-stat gray">
                            <span class="wave-stat-value">{cancelledWaves}</span>
                            <span class="wave-stat-label">Cancelled</span>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
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
    
    .header-right {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
        flex-wrap: wrap;
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
    
    .empty-state :global(.empty-icon) {
        color: var(--ds-text-tertiary);
        opacity: 0.5;
        margin-bottom: var(--ds-space-4);
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
    
    .status-content {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-6);
    }
    
    /* Progress Section */
    .progress-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-4);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
    }
    
    .progress-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .progress-label {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
    }
    
    .progress-value {
        font-size: var(--ds-text-lg);
        font-weight: var(--ds-font-bold);
        color: var(--ds-text-primary);
    }
    
    .progress-details {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        margin-top: var(--ds-space-1);
    }
    
    .progress-detail {
        font-size: var(--ds-text-xs);
        color: var(--ds-text-secondary);
    }
    
    .progress-detail.error {
        color: var(--ds-color-error-500);
        font-weight: var(--ds-font-medium);
    }
    
    /* Statistics Grid */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--ds-space-4);
    }
    
    @media (max-width: 1024px) {
        .stats-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
    
    @media (max-width: 480px) {
        .stats-grid {
            grid-template-columns: 1fr;
        }
    }
    
    .stat-card {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
        padding: var(--ds-space-4);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
        transition: all 0.2s ease;
    }
    
    .stat-card:hover {
        background: var(--ds-bg-tertiary, #F3F4F6);
        transform: translateY(-1px);
    }
    
    .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: var(--ds-radius-full);
        flex-shrink: 0;
        transition: transform 0.2s ease;
    }
    
    .stat-card:hover .stat-icon {
        transform: scale(1.05);
    }
    
    .stat-icon.success {
        background: var(--ds-color-success-50);
        color: var(--ds-color-success-500);
    }
    
    .stat-icon.primary {
        background: var(--ds-color-primary-50);
        color: var(--ds-color-primary-500);
    }
    
    .stat-icon.warning {
        background: var(--ds-color-warning-50);
        color: var(--ds-color-warning-500);
    }
    
    .stat-icon.error {
        background: var(--ds-color-error-50);
        color: var(--ds-color-error-500);
    }
    
    .stat-content {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-0-5);
    }
    
    .stat-value {
        font-size: var(--ds-text-2xl);
        font-weight: var(--ds-font-bold);
        color: var(--ds-text-primary);
        line-height: 1;
    }
    
    .stat-label {
        font-size: var(--ds-text-xs);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }
    
    /* Wave Summary */
    .wave-summary {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        padding-top: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-default);
    }
    
    .wave-summary-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
    }
    
    .wave-summary-title {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-semibold);
        color: var(--ds-text-primary);
    }
    
    .wave-stats {
        display: flex;
        align-items: center;
        gap: var(--ds-space-4);
        flex-wrap: wrap;
    }
    
    .wave-stat {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }
    
    .wave-stat-value {
        font-size: var(--ds-text-xl);
        font-weight: var(--ds-font-bold);
        color: var(--ds-text-primary);
    }
    
    .wave-stat-label {
        font-size: var(--ds-text-sm);
        color: var(--ds-text-secondary);
    }
    
    .wave-stat.success .wave-stat-value {
        color: var(--ds-color-success-500);
    }
    
    .wave-stat.primary .wave-stat-value {
        color: var(--ds-color-primary-500);
    }
    
    .wave-stat.warning .wave-stat-value {
        color: var(--ds-color-warning-500);
    }
    
    .wave-stat.error .wave-stat-value {
        color: var(--ds-color-error-500);
    }
    
    .wave-stat.gray .wave-stat-value {
        color: var(--ds-text-tertiary);
    }
    
    .wave-stat-divider {
        width: 1px;
        height: 24px;
        background: var(--ds-border-default);
    }
    
    /* Responsive */
    @media (max-width: 640px) {
        .header-content {
            flex-direction: column;
            align-items: stretch;
        }
        
        .header-right {
            justify-content: flex-start;
        }
        
        .wave-stat-divider {
            display: none;
        }
        
        .wave-stats {
            gap: var(--ds-space-3);
        }
    }
    
    /* Animations */
    :global(.animate-spin) {
        animation: spin 1s linear infinite;
    }
    
    :global(.animate-spin-slow) {
        animation: spin 2s linear infinite;
    }
    
    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
