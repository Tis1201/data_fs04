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
    import { Info, KeyRound, Pencil, Section, Copy } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { canPerformAdminActions } from '$lib/utils/permissions';
    import PasswordUpdateDialog from '$lib/components/ui_components_sveltekit/dialog/PasswordUpdateDialog.svelte';
    import ResetPasswordDialog from '$lib/components/ui_components_sveltekit/dialog/ResetPasswordDialog.svelte';
    import EditMemberModal from '$lib/components/ui_components_sveltekit/dialog/EditMemberModal.svelte';
    import { formatTableDateTime } from '$lib/utils/format';

    export let data: PageData;

    interface SessionRow {
        id: string;
        createdAt: string;
        expiresAt: string;
        status: string | null;
    }

    $: user = data.user;
    $: currentAccount = data.currentAccount;
    $: canEdit = data.canEdit ?? false;
    $: sessions = (data.sessions || []) as unknown as SessionRow[];
    $: sessionsMeta = data.sessionsMeta || null;
    $: sessionsSortField = data.sessionsSortField ?? 'createdAt';
    $: sessionsSortOrder = (data.sessionsSortOrder ?? 'desc') as 'asc' | 'desc';

    let sessionsPagination: PaginationState = {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0
    };
    $: if (sessionsMeta) {
        sessionsPagination = {
            page: sessionsMeta.currentPage,
            pageSize: sessionsMeta.itemsPerPage,
            totalItems: sessionsMeta.totalItems,
            totalPages: sessionsMeta.totalPages
        };
    }

    const sessionColumns: ColumnDef<SessionRow>[] = [
        { id: 'id', header: 'ID', accessor: (r) => r.id.length > 32 ? r.id.slice(0, 32) + '...' : r.id, width: '25%', sortable: true },
        { id: 'device', header: 'Device/Browser', accessor: () => '—', width: '20%', sortable: true },
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

    function buildSessionsSortUrl(field: string | null, direction: 'asc' | 'desc' | null) {
        const u = new URL($page.url.pathname + $page.url.search, $page.url.origin);
        if (field && direction) {
            u.searchParams.set('session_sort_field', field);
            u.searchParams.set('session_sort_order', direction);
        } else {
            u.searchParams.delete('session_sort_field');
            u.searchParams.delete('session_sort_order');
        }
        return u.pathname + u.search;
    }

    function handleSessionsSort(event: CustomEvent<{ field: string | null; direction: 'asc' | 'desc' | null }>) {
        const { field, direction } = event.detail;
        goto(buildSessionsSortUrl(field, direction));
    }

    async function handleRevokeSession() {
        if (!revokeSession) return;
        revokeLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', revokeSession.id);
            const res = await fetch(`/user/settings/users/${user?.id}/sessions?/revokeSession`, { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.success || result.type === 'success') {
                toast.success('Session revoked successfully!');
                closeRevokeModal();
                await invalidateAll();
                goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.error || result.message || 'Unable to revoke Session. Please try again!');
            }
        } catch {
            toast.error('Unable to revoke Session. Please try again!');
        } finally {
            revokeLoading = false;
        }
    }

    // Edit Member modal (shared EditMemberModal component)
    let showEditModal = false;
    let editLoading = false;

    function openEditModal() {
        showEditModal = true;
    }

    function closeEditModal() {
        showEditModal = false;
    }

    async function handleEditSave(e: CustomEvent<{ userId: string; name: string; email: string; accountRole: string; status: string; password?: string }>) {
        const p = e.detail;
        editLoading = true;
        try {
            const fd = new FormData();
            fd.set('userId', p.userId);
            fd.set('name', p.name);
            fd.set('email', p.email);
            fd.set('accountRole', p.accountRole);
            fd.set('status', p.status);
            if (p.password) fd.set('password', p.password);
            const res = await fetch('/user/settings/users?/updateMember', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Member updated successfully');
                closeEditModal();
                await invalidateAll();
                goto($page.url.pathname + $page.url.search, { invalidateAll: true });
            } else {
                toast.error(result.data?.message || result.message || 'Unable to update member. Please try again.');
            }
        } catch {
            toast.error('Unable to update member. Please try again.');
        } finally {
            editLoading = false;
        }
    }

    function formatDate(d: string | Date | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        return formatTableDateTime(date);
    }

    let passwordUpdateOpen = false;
    let passwordResetOpen = false;

    $: userForPasswordDialog = user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            password: '',
            rolesString: '',
            primaryAccountId: null,
            status: user.status || 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            systemRole: user.systemRole || 'USER'
        }
        : null;
</script>

<div class="member-detail-page">
    <div class="detail-top-row">
        <div class="detail-top-spacer"></div>
        {#if canPerformAdminActions(currentAccount)}
            <div class="detail-actions">
                <Button
                    variant="outline"
                    color="primary"
                    size="lg"
                    icon={KeyRound}
                    iconPosition="left"
                    on:click={() => (passwordUpdateOpen = true)}
                >
                    Update Password
                </Button>
                <Button
                    variant="outline"
                    color="primary"
                    size="lg"
                    icon={KeyRound}
                    iconPosition="left"
                    on:click={() => (passwordResetOpen = true)}
                >
                    Reset Password
                </Button>
                <Button
                    variant="filled"
                    color="primary"
                    size="lg"
                    icon={Pencil}
                    iconPosition="left"
                    on:click={openEditModal}
                >
                    Edit Member
                </Button>
            </div>
        {/if}
    </div>

    <!-- Member Overview Card -->
    <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="info-card">
        <div slot="header" class="section-header">
            <div class="section-header-icon" aria-hidden="true">
                <Info class="icon-md" size={20} strokeWidth={1.5} />
            </div>
            <div class="section-header-content">
                <h2 class="section-title-sm">Member Overview</h2>
                <p class="section-subtitle">Manage member details</p>
            </div>
        </div>
        <div class="info-card-body">
            <!-- Row 1: Member Name | Account Role | Status -->
            <!-- Row 2: Contact Email | (empty) | Password -->
            <div class="info-grid-row info-grid-overview">
                <div class="info-field">
                    <span class="info-label">Member Name</span>
                    <span class="info-value">{user?.name || '—'}</span>
                </div>
                <div class="info-field">
                    <span class="info-label">Account Role</span>
                    <span class="info-value">{user?.accountRole || 'Member'}</span>
                </div>
                <div class="info-field">
                    <span class="info-label">Status</span>
                    <span class="info-value">
                        <span class="status-dot" class:active={user?.status === 'ACTIVE'}></span>
                        {user?.status === 'ACTIVE' ? 'Active' : 'Deactivated'}
                    </span>
                </div>
                <div class="info-field">
                    <span class="info-label">Contact Email</span>
                    <span class="info-value">{user?.email || '—'}</span>
                </div>
                <div class="info-field info-field-empty" aria-hidden="true"></div>
                <div class="info-field">
                    <span class="info-label">Password</span>
                    <span class="info-value">******</span>
                </div>
            </div>
            {#if user?.createdAt || user?.updatedAt}
                <div class="audit-trail">
                    {#if user?.createdAt}
                        <p>Created on {formatDate(user.createdAt)}</p>
                    {/if}
                    {#if user?.updatedAt}
                        <p>Last updated on {formatDate(user.updatedAt)}</p>
                    {/if}
                </div>
            {/if}
        </div>
    </Card>

    <!-- Sessions Card (admin/owner only) -->
    {#if canPerformAdminActions(currentAccount) && sessionsMeta}
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
                    sort={{ field: sessionsSortField, direction: sessionsSortOrder }}
                    sortable={true}
                    loading={false}
                    bordered={true}
                    emptyMessage="No sessions"
                    on:sort={handleSessionsSort}
                />
                {#if sessionsMeta.totalPages > 1}
                    <div class="sessions-nav">
                        <Button
                            variant="text"
                            color="primary"
                            size="sm"
                            on:click={() => goto(`/user/settings/users/${user?.id}/sessions`)}
                        >
                            View all sessions
                        </Button>
                    </div>
                {/if}
            </div>
        </Card>
    {/if}
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

<!-- Edit Member Modal (shared component, same as listing) -->
<EditMemberModal
    bind:open={showEditModal}
    member={user ? { id: user.id, name: user.name, email: user.email, accountRole: user.accountRole ?? 'MEMBER', status: user.status ?? 'ACTIVE' } : null}
    loading={editLoading}
    on:close={closeEditModal}
    on:save={handleEditSave}
/>

{#if userForPasswordDialog}
    <PasswordUpdateDialog
        bind:open={passwordUpdateOpen}
        user={userForPasswordDialog}
        action="?/updatePassword"
        onSuccess={() => invalidateAll()}
    />
    <ResetPasswordDialog
        bind:open={passwordResetOpen}
        user={userForPasswordDialog}
        action="?/resetPassword"
        onSuccess={() => {
            invalidateAll();
        }}
    />
{/if}

<style>
    .member-detail-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
        background: var(--ds-bg-secondary);
        padding: var(--ds-space-6);
        gap: var(--ds-space-6);
    }

    .detail-top-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        margin-bottom: var(--ds-space-2);
    }

    .detail-top-spacer {
        flex: 1;
    }

    .detail-actions {
        display: flex;
        gap: var(--ds-space-3);
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

    .info-card-body,
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

    .info-grid-row {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--ds-space-4) var(--ds-space-6);
    }

    /* Member Overview: 3 columns — Row1: Name | Role | Status, Row2: Email | empty | Password */
    .info-grid-overview {
        grid-template-columns: repeat(3, 1fr);
    }

    .info-field-empty {
        min-height: 0;
    }

    .info-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-0-5);
    }

    .info-label {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .info-value {
        font: var(--ds-text-sm-medium);
        color: var(--ds-text-primary);
    }

    .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ds-color-neutral-true-400);
        margin-right: var(--ds-space-1);
    }

    .status-dot.active {
        background: var(--ds-color-success-500);
    }

    .audit-trail {
        margin-top: var(--ds-space-4);
        padding-top: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-default);
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .audit-trail p {
        margin: 0 0 var(--ds-space-1) 0;
    }

    .sessions-nav {
        margin-top: var(--ds-space-3);
    }

    /* View Session modal body: reduced padding (modal-body may add its own), gap 16px */
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
