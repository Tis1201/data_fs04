<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { invalidate } from '$app/navigation';
    import {
        Button,
        InputField,
        DataTable,
        Modal,
        ConfirmModal
    } from '$lib/design-system/components';
    import AddDeploymentModal from './components/AddDeploymentModal.svelte';
    import EditDeploymentModal from './components/EditDeploymentModal.svelte';
    import type { ColumnDef, SortState, ActionDef } from '$lib/design-system/components';
    import { Search, Plus } from 'lucide-svelte';
    import type { PageData } from './$types';
    import type { Bundle } from '@prisma/client';
    import {
        getBundleStatusDisplayLabel,
        getBundleStatusBadgeColor,
        formatBundleDate
    } from '$lib/utils/bundleUtils';
    import { toast } from '$lib/stores/alertToast';

    export let data: PageData;
    /** Route params from SvelteKit (avoids "unknown prop 'params'" warning) */
    export let params: Record<string, string> = {};

    $: bundles = (data as any)?.bundles ?? [];
    $: meta = (data as any)?.meta ?? {};
    $: serverPagination = meta.pagination ?? {};
    $: serverSort = meta.sort ?? { field: 'createdAt', order: 'desc' };

    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    let deleteTarget: Bundle | null = null;
    let showDeleteModal = false;
    let deleteLoading = false;

    let publishTarget: Bundle | null = null;
    let showPublishModal = false;
    let publishLoading = false;

    let duplicateTarget: Bundle | null = null;
    let showDuplicateModal = false;
    let duplicateLoading = false;

    let pauseTarget: Bundle | null = null;
    let showPauseModal = false;
    let pauseLoading = false;

    let cancelTarget: Bundle | null = null;
    let showCancelModal = false;
    let cancelLoading = false;

    let showAddModal = false;

    let editTarget: Bundle | null = null;
    let showEditModal = false;

    $: pagination = {
        page: serverPagination.page ?? 1,
        pageSize: serverPagination.per_page ?? 10,
        totalItems: serverPagination.total_records ?? 0,
        totalPages: serverPagination.total_pages ?? 0
    };

    let sort: SortState = { field: 'createdAt', direction: 'desc' };
    $: sort = {
        field: serverSort.field || 'createdAt',
        direction: (serverSort.order as 'asc' | 'desc') || 'desc'
    };

    const basePath = '/user/iot/bundles';

    // Debounced search
    $: if (browser && typeof searchValue !== 'undefined') {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const current = $page.url.searchParams.get('search') || '';
            const next = searchValue.trim();
            if (next === current) return;
            const url = new URL($page.url);
            if (next) url.searchParams.set('search', next);
            else url.searchParams.delete('search');
            url.searchParams.set('page', '1');
            goto(url.pathname + url.search, { noScroll: true });
        }, 500);
    }

    function handleSort(event: CustomEvent<SortState>) {
        const next = event.detail;
        const url = new URL($page.url);
        if (next.field && next.direction) {
            url.searchParams.set('sort', next.field);
            url.searchParams.set('order', next.direction);
        } else {
            url.searchParams.delete('sort');
            url.searchParams.delete('order');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handlePageSizeChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('per_page', String(event.detail));
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
    }

    async function handleAddDeploymentCreated(event: CustomEvent<{ id: string }>) {
        showAddModal = false;
        await invalidate('app:bundles');
        goto(`${basePath}/${event.detail.id}`);
    }

    async function handleEditDeploymentSaved(event: CustomEvent<{ id: string }>) {
        showEditModal = false;
        editTarget = null;
        await invalidate('app:bundles');
        goto(`${basePath}/${event.detail.id}`);
    }

    function openDeleteModal(bundle: Bundle) {
        deleteTarget = bundle;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        deleteTarget = null;
    }

    function openPublishModal(bundle: Bundle) {
        publishTarget = bundle;
        showPublishModal = true;
    }

    function closePublishModal() {
        showPublishModal = false;
        publishTarget = null;
    }

    async function confirmPublish() {
        if (!publishTarget) return;
        publishLoading = true;
        try {
            const res = await fetch(`/api/v2/bundles/${publishTarget.id}/publish`, { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result.success) {
                toast.success('Deployment published successfully!');
                closePublishModal();
                await invalidate('app:bundles');
                await goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.message || 'Unable to publish Deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to publish Deployment. Please try again!');
        } finally {
            publishLoading = false;
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', deleteTarget.id);
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Deployment deleted successfully!');
                closeDeleteModal();
                await invalidate('app:bundles');
                await goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.message || 'Unable to delete deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to delete deployment. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Duplicate modal handlers
    function openDuplicateModal(bundle: Bundle) {
        duplicateTarget = bundle;
        showDuplicateModal = true;
    }

    function closeDuplicateModal() {
        showDuplicateModal = false;
        duplicateTarget = null;
    }

    async function confirmDuplicate() {
        if (!duplicateTarget) return;
        duplicateLoading = true;
        try {
            const res = await fetch(`/api/v2/bundles/${duplicateTarget.id}/duplicate`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            const newId = json.data?.id || json.id;
            if (json.success && newId) {
                toast.success('Deployment duplicated successfully!');
                closeDuplicateModal();
                await invalidate('app:bundles');
                goto(`${basePath}/${newId}`);
            } else {
                toast.error(json.error?.message || 'Unable to duplicate deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to duplicate deployment. Please try again!');
        } finally {
            duplicateLoading = false;
        }
    }

    // Pause modal handlers
    function openPauseModal(bundle: Bundle) {
        pauseTarget = bundle;
        showPauseModal = true;
    }

    function closePauseModal() {
        showPauseModal = false;
        pauseTarget = null;
    }

    async function confirmPause() {
        if (!pauseTarget) return;
        pauseLoading = true;
        try {
            const res = await fetch(`/api/v2/bundles/${pauseTarget.id}/stop`, { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result.success) {
                toast.success('Deployment paused successfully!');
                closePauseModal();
                await invalidate('app:bundles');
                await goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.message || 'Unable to pause deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to pause deployment. Please try again!');
        } finally {
            pauseLoading = false;
        }
    }

    // Cancel deployment modal handlers
    function openCancelModal(bundle: Bundle) {
        cancelTarget = bundle;
        showCancelModal = true;
    }

    function closeCancelModal() {
        showCancelModal = false;
        cancelTarget = null;
    }

    async function confirmCancel() {
        if (!cancelTarget) return;
        cancelLoading = true;
        try {
            const res = await fetch(`/api/v2/bundles/${cancelTarget.id}/cancel`, { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result.success) {
                toast.success('Deployment canceled successfully!');
                closeCancelModal();
                await invalidate('app:bundles');
                await goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.message || 'Unable to cancel deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to cancel deployment. Please try again!');
        } finally {
            cancelLoading = false;
        }
    }

    // Resume deployment (no modal, just API call with toast)
    async function handleResume(bundle: Bundle) {
        try {
            const res = await fetch(`/api/v2/bundles/${bundle.id}/resume`, { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result.success) {
                toast.success('Deployment resumed successfully!');
                await invalidate('app:bundles');
                await goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.message || 'Unable to resume deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to resume deployment. Please try again!');
        }
    }

    // Run deployment (no modal, just API call with toast)
    async function handleRun(bundle: Bundle) {
        try {
            const res = await fetch(`/api/v2/bundles/${bundle.id}/run`, { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result.success) {
                toast.success('Deployment run successfully!');
                await invalidate('app:bundles');
                goto(`${basePath}/${bundle.id}`);
            } else {
                toast.error(result.message || 'Unable to run deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to run deployment. Please try again!');
        }
    }

    // Retry deployment (no modal, just API call with toast)
    async function handleRetry(bundle: Bundle) {
        try {
            const res = await fetch(`/api/v2/bundles/${bundle.id}/retry`, { method: 'POST' });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result.success) {
                toast.success('Deployment re-run successfully!');
                await invalidate('app:bundles');
                goto(`${basePath}/${bundle.id}`);
            } else {
                toast.error(result.message || 'Unable to re-run deployment. Please try again!');
            }
        } catch {
            toast.error('Unable to re-run deployment. Please try again!');
        }
    }

    /** Deployment action menus by status (Figma: Draft / Scheduled / In Progress / Completed / Failed / Stopped / Cancelled) */
    function getMenuActions(bundle: Bundle): ActionDef<Bundle>[] {
        const status = (bundle.status || '').toUpperCase();
        const isScheduled = status === 'PUBLISHED' && !!bundle.scheduledAt;
        const hasSchedule = !!bundle.scheduledAt;

        const view = (b: Bundle) => goto(`${basePath}/${b.id}`);
        const edit = (b: Bundle) => {
            editTarget = b;
            showEditModal = true;
        };
        const duplicate = (b: Bundle) => openDuplicateModal(b);
        const del = (b: Bundle) => openDeleteModal(b);
        const pause = (b: Bundle) => openPauseModal(b);
        const cancel = (b: Bundle) => openCancelModal(b);
        const resume = (b: Bundle) => handleResume(b);
        const run = (b: Bundle) => handleRun(b);
        const retry = (b: Bundle) => handleRetry(b);

        // Build list per status with exact Figma order; no icons in menu (text only); destructive use color: 'danger'
        if (status === 'DRAFT') {
            return [
                { id: 'publish', label: 'Publish', onClick: openPublishModal },
                { id: 'view', label: 'View', onClick: view },
                { id: 'edit', label: 'Edit', onClick: edit },
                { id: 'duplicate', label: 'Duplicate', onClick: duplicate },
                { id: 'delete', label: 'Delete', color: 'danger', onClick: del }
            ];
        }
        if (isScheduled) {
            return [
                { id: 'run', label: 'Run Deployment', onClick: run },
                { id: 'view', label: 'View', onClick: view },
                { id: 'edit', label: 'Edit', onClick: edit },
                { id: 'duplicate', label: 'Duplicate', onClick: duplicate },
                { id: 'delete', label: 'Delete', color: 'danger', onClick: del }
            ];
        }
        if (status === 'IN_PROGRESS') {
            return [
                { id: 'view', label: 'View', onClick: view },
                { id: 'duplicate', label: 'Duplicate', onClick: duplicate },
                { id: 'stop', label: 'Stop', color: 'danger', onClick: pause },
                { id: 'cancel', label: 'Cancel Deployment', color: 'danger', onClick: cancel }
            ];
        }
        if (status === 'COMPLETED') {
            if (!hasSchedule) {
                return [
                    { id: 'run', label: 'Run Deployment', onClick: run },
                    { id: 'view', label: 'View', onClick: view },
                    { id: 'duplicate', label: 'Duplicate', onClick: duplicate }
                ];
            }
            return [
                { id: 'view', label: 'View', onClick: view },
                { id: 'duplicate', label: 'Duplicate', onClick: duplicate }
            ];
        }
        if (status === 'FAILED') {
            return [
                { id: 'retry', label: 'Retry', onClick: retry },
                { id: 'view', label: 'View', onClick: view },
                { id: 'edit', label: 'Edit', onClick: edit },
                { id: 'duplicate', label: 'Duplicate', onClick: duplicate },
                { id: 'delete', label: 'Delete', color: 'danger', onClick: del }
            ];
        }
        if (status === 'STOPPED') {
            return [
                { id: 'resume', label: 'Resume', onClick: resume },
                { id: 'view', label: 'View', onClick: view },
                { id: 'edit', label: 'Edit', onClick: edit },
                { id: 'duplicate', label: 'Duplicate', onClick: duplicate },
                { id: 'cancel', label: 'Cancel Deployment', color: 'danger', onClick: cancel },
                { id: 'delete', label: 'Delete', color: 'danger', onClick: del }
            ];
        }
        if (status === 'CANCELLED') {
            return [
                { id: 'resume', label: 'Resume', onClick: resume },
                { id: 'view', label: 'View', onClick: view },
                { id: 'edit', label: 'Edit', onClick: edit },
                { id: 'duplicate', label: 'Duplicate', onClick: duplicate },
                { id: 'cancel', label: 'Cancel Deployment', color: 'danger', onClick: cancel },
                { id: 'delete', label: 'Delete', color: 'danger', onClick: del }
            ];
        }
        return [
            { id: 'view', label: 'View', onClick: view },
            { id: 'edit', label: 'Edit', onClick: edit },
            { id: 'duplicate', label: 'Duplicate', onClick: duplicate },
            { id: 'delete', label: 'Delete', color: 'danger', onClick: del }
        ];
    }

    function formatStartOn(bundle: Bundle): string {
        if (!bundle.scheduledAt) return '—';
        return formatBundleDate(bundle.scheduledAt);
    }

    function formatEndOn(bundle: Bundle & { activePeriodDays?: number }): string {
        if (!bundle.scheduledAt) return '—';
        const startDate = new Date(bundle.scheduledAt);
        const days = bundle.activePeriodDays ?? 1;
        const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
        return formatBundleDate(endDate);
    }

    function escapeHtml(s: string): string {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const columns: ColumnDef<Bundle>[] = [
        {
            id: 'name',
            header: 'Deployment Name',
            accessor: (row: Bundle) => row.name || row.id,
            type: 'custom',
            sortable: true,
            minWidth: '200px',
            render: (value: unknown, row: Bundle) => {
                const label = escapeHtml(row.name || row.id || 'Unnamed');
                const href = `${basePath}/${row.id}`;
                return `<a href="${escapeHtml(href)}" class="ds-deployment-name ds-deployment-name-link" title="${label}">${label}</a>`;
            }
        },
        {
            id: 'version',
            header: 'Version',
            accessor: (row: Bundle) => row.version || '—',
            type: 'text',
            sortable: true,
            width: '100px'
        },
        {
            id: 'scheduledAt',
            header: 'Start On',
            accessor: (row: Bundle) => formatStartOn(row),
            type: 'text',
            sortable: true,
            width: '180px'
        },
        {
            id: 'endOn',
            header: 'End On',
            accessor: (row: Bundle) => formatEndOn(row as Bundle & { activePeriodDays?: number }),
            type: 'text',
            sortable: true,
            width: '180px'
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (row: Bundle) => getBundleStatusDisplayLabel(row.status, row),
            type: 'badge',
            sortable: true,
            statusColor: (_value: unknown, row: Bundle) => getBundleStatusBadgeColor(row.status, row),
            showDot: () => true,
            width: '140px'
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            width: '85px',
            maxWidth: '85px',
            getMenuActions: (row: Bundle) => getMenuActions(row)
        }
    ];
</script>

<div class="bundles-list-page">
    <div class="list-toolbar">
        <div class="search-wrap">
            <InputField
                type="search"
                placeholder="Search by Name or ID"
                bind:value={searchValue}
                prefixIcon={true}
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>
        <div class="flex-1"></div>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={() => (showAddModal = true)}
        >
            <Plus size={20} slot="icon-left" />
            Add Deployment
        </Button>
    </div>

    <!-- Table container: Figma Content — bg white, border, border-radius 9px, flex col -->
    <div class="table-container">
        <DataTable
            {columns}
            data={bundles}
            keyField="id"
            selectable={false}
            sortable={true}
            bind:sort
            paginated={true}
            {pagination}
            loading={false}
            emptyMessage="No deployments found"
            compact={true}
            bordered={false}
            on:sort={handleSort}
            on:pageChange={handlePageChange}
            on:pageSizeChange={handlePageSizeChange}
        />
    </div>
</div>

<AddDeploymentModal
    open={showAddModal}
    on:close={() => (showAddModal = false)}
    on:created={handleAddDeploymentCreated}
/>

<EditDeploymentModal
    open={showEditModal}
    bundle={editTarget}
    on:close={() => { showEditModal = false; editTarget = null; }}
    on:saved={handleEditDeploymentSaved}
/>

<Modal
    open={showPublishModal}
    title="Deployment Confirm"
    type="warning"
    size="md"
    cancelText="Cancel"
    confirmText="Confirm"
    confirmLoading={publishLoading}
    confirmDisabled={publishLoading}
    on:close={closePublishModal}
    on:confirm={confirmPublish}
>
    <p class="modal-confirm-text">
        Are you sure you want to create this deployment?
    </p>
    <p class="modal-confirm-desc">
        This action will trigger the deployment automatically based on the scheduled date & time. If no schedule is configured, the deployment will require manual execution.
    </p>
</Modal>

<ConfirmModal
    open={showDeleteModal}
    title="Delete Deployment"
    description="Are you sure you want to delete this deployment? This action can not be reverse."
    cancelText="Cancel"
    confirmText="Delete"
    confirmLoading={deleteLoading}
    confirmDisabled={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={confirmDelete}
/>

<Modal
    open={showDuplicateModal}
    title="Duplicate Deployment"
    type="info"
    size="md"
    cancelText="Cancel"
    confirmText="Duplicate"
    confirmLoading={duplicateLoading}
    confirmDisabled={duplicateLoading}
    on:close={closeDuplicateModal}
    on:confirm={confirmDuplicate}
>
    <p class="modal-action-text">
        Do you want to proceed with the duplicate? The new deployment will use the same title and settings.
    </p>
</Modal>

<Modal
    open={showPauseModal}
    title="Pause Deployment"
    type="warning"
    size="md"
    cancelText="Cancel"
    confirmText="Pause"
    confirmLoading={pauseLoading}
    confirmDisabled={pauseLoading}
    on:close={closePauseModal}
    on:confirm={confirmPause}
>
    <p class="modal-action-text">
        Are you sure you want to pause this deployment? The deployment will stop running and can be resumed later.
    </p>
</Modal>

<Modal
    open={showCancelModal}
    title="Cancel Deployment"
    type="warning"
    size="md"
    cancelText="Cancel"
    confirmText="Confirm"
    confirmLoading={cancelLoading}
    confirmDisabled={cancelLoading}
    on:close={closeCancelModal}
    on:confirm={confirmCancel}
>
    <p class="modal-action-text">
        Are you sure you want to cancel this deployment? The deployment will stop permanently and cannot be undone.
    </p>
</Modal>

<style>
    .bundles-list-page {
        padding: var(--ds-space-6);
        gap: var(--ds-space-4);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        width: 100%;
    }
    .list-toolbar {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: 100%;
        gap: var(--ds-space-4);
        height: 48px;
    }
    .search-wrap {
        width: 500px;
        max-width: 100%;
        height: 48px;
    }
    .flex-1 {
        flex: 1;
    }
    /* Figma Content: table container — Base/White, border Neutral-True/200, radius 9px; allow horizontal scroll */
    .table-container {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 0;
        width: 100%;
        min-width: 0;
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-color-neutral-true-200);
        border-radius: 9px;
        overflow-x: auto;
        overflow-y: visible;
        flex: none;
    }
    .table-container :global(.ds-datatable) {
        border: none;
        border-radius: 0;
        box-shadow: none;
    }
    .table-container :global(.ds-datatable table) {
        border-radius: 0;
        width: 100%;
        table-layout: fixed;
    }
    /* Figma Table cell: padding 16px, min-height 52px, border-bottom Gray/200 */
    .table-container :global(.ds-datatable tbody td) {
        padding-top: var(--ds-space-4);
        padding-bottom: var(--ds-space-4);
        min-height: 52px;
        height: 52px;
        box-sizing: border-box;
    }
    /* Figma Table header cell: padding 12px 16px, height 44px, bg Neutral-True/100, border-bottom Gray/200 */
    .table-container :global(.ds-datatable thead th) {
        padding: var(--ds-space-3) var(--ds-space-4);
        gap: var(--ds-space-3);
        height: 44px;
        min-height: 44px;
        background: var(--ds-color-neutral-true-100);
        border-bottom: 1px solid var(--ds-border-default);
        font-family: var(--ds-font-family-primary);
        font-weight: var(--ds-font-medium);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-color-gray-600);
    }
    /* Figma Pagination Details: Body/14-Regular, Neutral-True/600 #525252 */
    .table-container :global(.ds-pagination-details) {
        color: var(--ds-color-neutral-true-600);
        font-weight: 400;
    }
    .modal-confirm-text {
        font-family: var(--ds-font-family-primary);
        color: var(--ds-text-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        margin: 0 0 var(--ds-space-2) 0;
    }
    .modal-confirm-desc {
        font-family: var(--ds-font-family-primary);
        color: var(--ds-text-secondary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        margin: 0;
    }
    .modal-action-text {
        font-family: var(--ds-font-family-primary);
        color: var(--ds-text-secondary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        margin: 0;
    }
    :global(.ds-deployment-name) {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 400px;
    }
    :global(.ds-deployment-name-link) {
        color: var(--ds-color-blue-light-600, #2563EB);
        text-decoration: none;
    }
    :global(.ds-deployment-name-link:hover) {
        text-decoration: underline;
    }
</style>
