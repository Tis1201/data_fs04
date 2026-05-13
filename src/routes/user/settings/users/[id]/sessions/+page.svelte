<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { toast } from '$lib/stores/alertToast';
    import {
        Button,
        Card,
        DataTable,
        Modal,
        ConfirmModal
    } from '$lib/design-system/components';
    import type { ColumnDef, PaginationState } from '$lib/design-system/components';
    import { Section, Copy } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { formatTableDateTime } from '$lib/utils/format';

    export let data: PageData;

    interface SessionRow {
        id: string;
        createdAt: string | Date;
        expiresAt: string | Date;
        status: string | null;
    }

    $: user = data.user;
    $: sessions = (data.sessions || []) as unknown as SessionRow[];
    $: meta = data.meta || {};

    let sessionsPagination: PaginationState = {
        page: meta.page ?? 1,
        pageSize: meta.per_page ?? 10,
        totalItems: meta.total_records ?? 0,
        totalPages: meta.total_pages ?? 1
    };
    $: if (meta.total_records !== undefined) {
        sessionsPagination = {
            page: meta.page ?? 1,
            pageSize: meta.per_page ?? 10,
            totalItems: meta.total_records ?? 0,
            totalPages: meta.total_pages ?? 1
        };
    }

    let sortField = meta.sort_field || 'createdAt';
    let sortOrder = (meta.sort_order || 'desc') as 'asc' | 'desc';

    const sessionColumns: ColumnDef<SessionRow>[] = [
        { id: 'id', header: 'ID', accessor: (r) => (r.id.length > 32 ? r.id.slice(0, 32) + '...' : r.id), width: '25%' },
        { id: 'device', header: 'Device/Browser', accessor: () => '—', width: '20%' },
        { id: 'createdAt', header: 'Created On', type: 'datetime', accessor: 'createdAt', sortable: true, width: '20%' },
        { id: 'expiresAt', header: 'Expired On', type: 'datetime', accessor: 'expiresAt', sortable: true, width: '20%' },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            width: '15%',
            align: 'center',
            getMenuActions: (row: SessionRow) => [
                { id: 'view', label: 'View', onClick: () => openViewSessionModal(row) },
                { id: 'revoke', label: 'Revoke', destructive: true, onClick: () => openRevokeModal(row) }
            ]
        }
    ];

    function buildSessionsUrl(params: { page?: number; per_page?: number; sort_field?: string; sort_order?: string }) {
        const url = new URL($page.url.pathname + $page.url.search, $page.url.origin);
        if (params.page != null) url.searchParams.set('page', String(params.page));
        if (params.per_page != null) url.searchParams.set('per_page', String(params.per_page));
        if (params.sort_field != null) url.searchParams.set('sort_field', params.sort_field);
        if (params.sort_order != null) url.searchParams.set('sort_order', params.sort_order);
        return url.pathname + url.search;
    }

    function handleSort(event: CustomEvent<{ field: string | null; direction: 'asc' | 'desc' | null }>) {
        const { field, direction } = event.detail;
        if (field && direction) goto(buildSessionsUrl({ sort_field: field, sort_order: direction }));
    }

    function handlePageChange(event: CustomEvent<number>) {
        const newPage = event.detail;
        goto(buildSessionsUrl({ page: newPage }));
    }

    // View Session modal
    let showViewSessionModal = false;
    let viewSession: SessionRow | null = null;

    function openViewSessionModal(row: SessionRow) {
        viewSession = row;
        showViewSessionModal = true;
    }

    function closeViewSessionModal() {
        showViewSessionModal = false;
        viewSession = null;
    }

    function formatDate(d: string | Date | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        return formatTableDateTime(date);
    }

    async function copySessionId() {
        if (!viewSession) return;
        try {
            await navigator.clipboard.writeText(viewSession.id);
            toast.success('Session ID copied');
        } catch {
            toast.error('Failed to copy');
        }
    }

    // Revoke Session modal
    let showRevokeModal = false;
    let revokeSession: SessionRow | null = null;
    let revokeLoading = false;

    function openRevokeModal(row: SessionRow) {
        revokeSession = row;
        showRevokeModal = true;
    }

    function closeRevokeModal() {
        showRevokeModal = false;
        revokeSession = null;
    }

    async function handleRevokeSession() {
        if (!revokeSession || !user?.id) return;
        revokeLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', revokeSession.id);
            const res = await fetch(`?/revokeSession`, { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.success || result.type === 'success') {
                toast.success('Session revoked successfully!');
                closeRevokeModal();
                await invalidateAll();
            } else {
                toast.error(result.error || result.message || 'Unable to revoke session. Please try again!');
            }
        } catch {
            toast.error('Unable to revoke session. Please try again!');
        } finally {
            revokeLoading = false;
        }
    }
</script>

<div class="sessions-page">
    <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="sessions-card">
        <div slot="header" class="section-header">
            <div class="section-header-icon" aria-hidden="true">
                <Section class="icon-md" size={20} strokeWidth={1.5} />
            </div>
            <div class="section-header-content">
                <h2 class="section-title-sm">Sessions</h2>
                <p class="section-subtitle">Session of this member</p>
            </div>
        </div>
        <div class="sessions-card-body">
            <DataTable
                data={sessions}
                columns={sessionColumns}
                pagination={sessionsPagination}
                sort={{ field: sortField, direction: sortOrder }}
                loading={false}
                bordered={true}
                paginated={true}
                emptyMessage="No sessions"
                on:sort={handleSort}
                on:pageChange={handlePageChange}
            />
        </div>
    </Card>
</div>

<!-- View Session Modal: 550px, body padding reduced, Close centered -->
<Modal
    open={showViewSessionModal}
    title="View Session"
    width="550px"
    on:close={closeViewSessionModal}
>
    {#if viewSession}
        <div class="view-session-body">
            <div class="view-session-field">
                <span class="view-session-label">Session Identifier <span class="required-asterisk" aria-hidden="true">*</span></span>
                <div class="session-id-bar">
                    <span class="session-id-value" title={viewSession.id}>{viewSession.id}</span>
                    <button type="button" class="session-copy-btn" aria-label="Copy session ID" on:click={copySessionId}>
                        <Copy size={22} strokeWidth={1.5} />
                    </button>
                </div>
            </div>
            <div class="session-timing">
                <h3 class="session-timing-title">Session Timing</h3>
                <div class="session-timing-rows">
                    <div class="session-timing-row">
                        <span class="session-timing-label">Created On</span>
                        <span class="session-timing-value">{formatDate(viewSession.createdAt)}</span>
                    </div>
                    <div class="session-timing-row">
                        <span class="session-timing-label">Expired On</span>
                        <span class="session-timing-value">{formatDate(viewSession.expiresAt)}</span>
                    </div>
                </div>
            </div>
        </div>
    {/if}
    <div slot="footer" class="view-session-footer">
        <Button variant="filled" color="primary" size="lg" on:click={closeViewSessionModal}>
            Close
        </Button>
    </div>
</Modal>

<!-- Revoke Session ConfirmModal -->
<ConfirmModal
    open={showRevokeModal}
    title="Revoke Session"
    description="Are you sure you want to revoke this session? This will log the user out immediately."
    cancelText="Cancel"
    confirmText="Revoke"
    type="warning"
    confirmLoading={revokeLoading}
    on:close={closeRevokeModal}
    on:confirm={handleRevokeSession}
/>

<style>
    .sessions-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
        background: var(--ds-bg-secondary);
        padding: var(--ds-space-6);
    }

    .section-header {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
    }

    .section-header-icon {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-color-neutral-true-400);
    }

    .section-header-content {
        flex: 1;
    }

    .section-title-sm {
        font: var(--ds-text-base-semibold);
        color: var(--ds-text-primary);
        margin: 0 0 var(--ds-space-0-5) 0;
    }

    .section-subtitle {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
        margin: 0;
    }

    .sessions-card-body {
        padding-top: var(--ds-space-4);
    }

    /* Prevent Sessions table cell content from overlapping (ID and text columns) */
    :global(.sessions-card .ds-datatable tbody td) {
        overflow: hidden;
    }

    :global(.sessions-card .ds-datatable tbody td > span) {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
    }

    .view-session-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 0 var(--ds-space-2);
        gap: var(--ds-space-4);
    }

    .view-session-footer {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: var(--ds-space-4);
        width: 100%;
    }

    .view-session-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }

    .view-session-label {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .view-session-label .required-asterisk {
        color: var(--ds-color-error-600);
    }

    .session-id-bar {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-space-3) var(--ds-space-3-5);
        gap: var(--ds-space-3);
        min-height: 48px;
        background: var(--ds-bg-primary);
        border: 1px solid var(--ds-border-default);
        border-radius: var(--ds-radius-lg);
        box-sizing: border-box;
    }

    .session-id-value {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: var(--ds-text-md-regular);
        color: var(--ds-text-primary);
    }

    .session-copy-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--ds-text-tertiary);
    }

    .session-copy-btn:hover {
        color: var(--ds-text-primary);
    }

    .session-timing {
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-4);
        gap: var(--ds-space-2);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-lg);
    }

    .session-timing-title {
        font: var(--ds-text-md-semibold);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .session-timing-rows {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .session-timing-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-4);
    }

    .session-timing-label {
        flex: 0 0 auto;
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .session-timing-value {
        flex: 1;
        font: var(--ds-text-md-medium);
        color: var(--ds-text-primary);
        text-align: right;
    }

</style>
