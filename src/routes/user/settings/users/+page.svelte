<script lang="ts">
    import { tick } from 'svelte';
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { toast } from '$lib/stores/alertToast';
    import {
        Button,
        InputField,
        DataTable,
        Modal,
        ConfirmModal,
        Dropdown,
        Toggle
    } from '$lib/design-system/components';
    import type { ColumnDef, PaginationState, BadgeColor } from '$lib/design-system/components';
    import { Search, Plus, Eye, EyeOff } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { canPerformAdminActions } from '$lib/utils/permissions';
    import PasswordUpdateDialog from '$lib/components/ui_components_sveltekit/dialog/PasswordUpdateDialog.svelte';
    import ResetPasswordDialog from '$lib/components/ui_components_sveltekit/dialog/ResetPasswordDialog.svelte';
    import EditMemberModal from '$lib/components/ui_components_sveltekit/dialog/EditMemberModal.svelte';

    export let data: PageData;

    interface MemberRow {
        id: string;
        name: string | null;
        email: string;
        role: string;
        systemRole?: string;
        status: string;
        createdAt: string;
        lastActive: string | null;
        activeSessionsCount: number;
        joinedAt: string;
    }

    $: members = (data.users || []) as unknown as MemberRow[];
    $: currentAccount = data.currentAccount;
    $: meta = data.meta || {};
    // Sort state from server meta. When server returns '', use null for unsort (no arrow).
    $: sort = {
        field: data.sort?.field && data.sort.field !== '' ? data.sort.field : null,
        direction: data.sort?.order && data.sort.order !== '' ? (data.sort.order as 'asc' | 'desc') : null
    };

    let loading = false;
    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;
    let searchWrapperEl: HTMLDivElement | null = null;

    let pagination: PaginationState = {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0
    };
    $: if (meta.totalItems !== undefined) {
        pagination = {
            page: meta.currentPage ?? 1,
            pageSize: meta.itemsPerPage ?? 10,
            totalItems: meta.totalItems ?? 0,
            totalPages: meta.totalPages ?? 1
        };
    }

    const columns: ColumnDef<MemberRow>[] = [
        {
            id: 'name',
            header: 'Member Name',
            type: 'textWithSupporting',
            accessor: (row) => row.name || row.email,
            supportingField: 'email',
            sortable: true,
            width: '25%'
        },
        {
            id: 'role',
            header: 'Account Role',
            accessor: (row) => row.role || 'Member',
            sortable: true,
            width: '15%'
        },
        {
            id: 'session',
            header: 'Session',
            accessor: (row) => row.activeSessionsCount ?? 0,
            sortable: true,
            width: '10%',
            align: 'left'
        },
        {
            id: 'createdAt',
            header: 'Created On',
            type: 'datetime',
            accessor: (row) => row.joinedAt || row.createdAt,
            sortable: true,
            width: '18%'
        },
        {
            id: 'status',
            header: 'Status',
            type: 'badge',
            accessor: (row) => (row.status === 'ACTIVE' ? 'Active' : 'Deactivated'),
            sortable: true,
            width: '12%',
            statusColor: (_v, row): BadgeColor => (row.status === 'ACTIVE' ? 'success' : 'gray'),
            showDot: () => true
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            width: '10%',
            align: 'center',
            getMenuActions: (row: MemberRow) => {
                const actions: { id: string; label: string; onClick?: () => void; destructive?: boolean }[] = [
                    { id: 'view', label: 'View', onClick: () => goto(`/user/settings/users/${row.id}`) },
                    { id: 'edit', label: 'Edit', onClick: () => openEditModal(row) }
                ];
                if (canPerformAdminActions(currentAccount)) {
                    actions.push(
                        {
                            id: 'toggle',
                            label: row.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate',
                            onClick: () => (row.status === 'ACTIVE' ? openDeactivateModal(row) : openReactivateModal(row))
                        },
                        { id: 'delete', label: 'Delete', destructive: true, onClick: () => openDeleteModal(row) }
                    );
                }
                return actions;
            }
        }
    ];

    function handleSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            const url = new URL($page.url);
            if (searchValue.trim()) url.searchParams.set('search', searchValue.trim());
            else url.searchParams.delete('search');
            url.searchParams.set('page', '1');
            await goto(url.pathname + url.search, { noScroll: true });
            await tick();
            // Restore focus to search input after navigation so user can keep typing
            const input = searchWrapperEl?.querySelector('input');
            if (input) input.focus();
        }, 300);
    }

    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handleSort(event: CustomEvent<{ field: string | null; direction: 'asc' | 'desc' | null }>) {
        const url = new URL($page.url);
        const field = event.detail.field;
        const direction = event.detail.direction;
        if (field && direction) {
            url.searchParams.set('sort_field', field);
            url.searchParams.set('sort_order', direction);
        } else {
            url.searchParams.delete('sort_field');
            url.searchParams.delete('sort_order');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
    }

    function handleRowClick(event: CustomEvent<{ row: MemberRow }>) {
        goto(`/user/settings/users/${event.detail.row.id}`);
    }

    // Add Member modal
    let showAddModal = false;
    let addLoading = false;
    let addName = '';
    let addEmail = '';
    let addAccountRole = 'MEMBER';
    let addActive = true;
    let addPassword = '';
    let addPasswordVisible = false;
    let addNameError = '';
    let addEmailError = '';
    let addPasswordError = '';

    const accountRoleOptions = [
        { id: 'MEMBER', label: 'Member' },
        { id: 'ADMIN', label: 'Admin' }
    ];

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function openAddModal() {
        addName = '';
        addEmail = '';
        addAccountRole = 'MEMBER';
        addActive = true;
        addPassword = '';
        addNameError = '';
        addEmailError = '';
        addPasswordError = '';
        showAddModal = true;
    }

    function closeAddModal() {
        showAddModal = false;
        addNameError = '';
        addEmailError = '';
        addPasswordError = '';
    }

    // Edit Member modal (shared EditMemberModal component)
    let showEditModal = false;
    let editLoading = false;
    let editTarget: MemberRow | null = null;

    function openEditModal(row: MemberRow) {
        editTarget = row;
        showEditModal = true;
    }

    function closeEditModal() {
        showEditModal = false;
        editTarget = null;
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
            const res = await fetch('?/updateMember', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Member updated successfully');
                closeEditModal();
                await invalidateAll();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.message || result.message || 'Unable to update member. Please try again.');
            }
        } catch {
            toast.error('Unable to update member. Please try again.');
        } finally {
            editLoading = false;
        }
    }

    async function handleAddMember() {
        addNameError = '';
        addEmailError = '';
        addPasswordError = '';
        if (!addName.trim()) {
            addNameError = 'Member name is required';
        }
        if (!addEmail.trim()) {
            addEmailError = 'Contact email is required';
        } else if (!emailRegex.test(addEmail.trim())) {
            addEmailError = 'Please enter a valid email address';
        }
        if (!addPassword) {
            addPasswordError = 'Password is required';
        }
        if (addNameError || addEmailError || addPasswordError) {
            return;
        }
        addLoading = true;
        try {
            const fd = new FormData();
            fd.set('name', addName.trim());
            fd.set('contactEmail', addEmail.trim());
            fd.set('accountRole', addAccountRole);
            fd.set('status', addActive ? 'ACTIVE' : 'INACTIVE');
            fd.set('password', addPassword);
            const res = await fetch('?/create', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Member added successfully');
                closeAddModal();
                await invalidateAll();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.error || 'Unable to add member. Please try again.');
            }
        } catch {
            toast.error('Unable to add member. Please try again.');
        } finally {
            addLoading = false;
        }
    }

    // Delete (Remove from account)
    let showDeleteModal = false;
    let deleteTarget: MemberRow | null = null;
    let deleteLoading = false;

    function openDeleteModal(row: MemberRow) {
        deleteTarget = row;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        deleteTarget = null;
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('userId', deleteTarget.id);
            const res = await fetch('?/removeFromAccount', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Member deleted successfully!');
                closeDeleteModal();
                await invalidateAll();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.message || result.message || 'Unable to delete Member. Please try again!');
            }
        } catch {
            toast.error('Unable to delete Member. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Deactivate
    let showDeactivateModal = false;
    let deactivateTarget: MemberRow | null = null;
    let deactivateLoading = false;

    function openDeactivateModal(row: MemberRow) {
        deactivateTarget = row;
        showDeactivateModal = true;
    }

    function closeDeactivateModal() {
        showDeactivateModal = false;
        deactivateTarget = null;
    }

    async function handleDeactivate() {
        if (!deactivateTarget) return;
        deactivateLoading = true;
        try {
            const fd = new FormData();
            fd.set('userId', deactivateTarget.id);
            fd.set('status', 'INACTIVE');
            const res = await fetch('?/updateUserStatus', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Member deactivated successfully!');
                closeDeactivateModal();
                await invalidateAll();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.message || result.message || 'Unable to deactivate Member. Please try again!');
            }
        } catch {
            toast.error('Unable to deactivate Member. Please try again!');
        } finally {
            deactivateLoading = false;
        }
    }

    // Reactivate
    let showReactivateModal = false;
    let reactivateTarget: MemberRow | null = null;
    let reactivateLoading = false;

    function openReactivateModal(row: MemberRow) {
        reactivateTarget = row;
        showReactivateModal = true;
    }

    function closeReactivateModal() {
        showReactivateModal = false;
        reactivateTarget = null;
    }

    async function handleReactivate() {
        if (!reactivateTarget) return;
        reactivateLoading = true;
        try {
            const fd = new FormData();
            fd.set('userId', reactivateTarget.id);
            fd.set('status', 'ACTIVE');
            const res = await fetch('?/updateUserStatus', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));
            if (result.type === 'success') {
                toast.success('Member reactivated successfully!');
                closeReactivateModal();
                await invalidateAll();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.message || result.message || 'Unable to reactivate Member. Please try again!');
            }
        } catch {
            toast.error('Unable to reactivate Member. Please try again!');
        } finally {
            reactivateLoading = false;
        }
    }

    // Password dialogs (for list row actions)
    let passwordDialogOpen = false;
    let resetDialogOpen = false;
    let selectedUser: MemberRow | null = null;

    function openPasswordDialog(row: MemberRow) {
        selectedUser = row;
        passwordDialogOpen = true;
    }

    function openResetDialog(row: MemberRow) {
        selectedUser = row;
        resetDialogOpen = true;
    }

    $: userForDialog = selectedUser
        ? {
            id: selectedUser.id,
            email: selectedUser.email,
            name: selectedUser.name,
            password: '',
            rolesString: '',
            primaryAccountId: null,
            status: selectedUser.status || 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            systemRole: selectedUser.systemRole || 'USER'
        }
        : null;
</script>

<div class="members-page">
    <div class="toolbar">
        <div class="search-wrapper" bind:this={searchWrapperEl}>
            <InputField
                placeholder="Search by Member name"
                bind:value={searchValue}
                on:input={handleSearch}
                prefixIcon={true}
            >
                <Search slot="prefix-icon" size={20} />
            </InputField>
        </div>
        {#if canPerformAdminActions(currentAccount)}
            <div class="actions-wrapper">
                <Button
                    variant="filled"
                    color="primary"
                    size="lg"
                    icon={Plus}
                    iconPosition="left"
                    on:click={openAddModal}
                >
                    Add Member
                </Button>
            </div>
        {/if}
    </div>

    <div class="table-wrapper">
        <DataTable
            data={members}
            {columns}
            {pagination}
            {sort}
            {loading}
            emptyMessage="No members found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
            on:rowClick={handleRowClick}
        />
    </div>
</div>

<!-- Add Member Modal: Row1 = Member Name (left) | Account Role + Active (right), Row2 = Contact Email (left) | Password (right) -->
<Modal
    open={showAddModal}
    title="Add Member"
    width="880px"
    on:close={closeAddModal}
>
    <div class="form-body modal-form-two-col">
        <div class="form-row">
            <div class="form-col">
                <InputField
                    label="Member Name"
                    placeholder="Enter"
                    bind:value={addName}
                    required={true}
                    state={addNameError ? 'error' : 'default'}
                    helperText={addNameError}
                />
            </div>
            <div class="form-col form-col-role-active">
                <div class="dropdown-field">
                    <span class="field-label">Account Role</span>
                    <Dropdown
                        options={accountRoleOptions}
                        bind:value={addAccountRole}
                        width="100%"
                        disabled={true}
                    />
                </div>
                <div class="toggle-field toggle-field-inline">
                    <Toggle bind:checked={addActive} />
                    <span class="field-label">Active</span>
                </div>
            </div>
        </div>
        <div class="form-row">
            <div class="form-col">
                <InputField
                    label="Contact Email"
                    placeholder="Enter"
                    type="email"
                    bind:value={addEmail}
                    required={true}
                    state={addEmailError ? 'error' : 'default'}
                    helperText={addEmailError}
                />
            </div>
            <div class="form-col">
                <InputField
                    label="Password"
                    placeholder="Enter"
                    type={addPasswordVisible ? 'text' : 'password'}
                    bind:value={addPassword}
                    required={true}
                    state={addPasswordError ? 'error' : 'default'}
                    helperText={addPasswordError}
                    suffixIcon={true}
                >
                    <button
                        slot="suffix-icon"
                        type="button"
                        class="password-toggle-btn"
                        aria-label={addPasswordVisible ? 'Hide password' : 'Show password'}
                        on:click|stopPropagation={() => (addPasswordVisible = !addPasswordVisible)}
                    >
                        {#if addPasswordVisible}
                            <EyeOff size={20} />
                        {:else}
                            <Eye size={20} />
                        {/if}
                    </button>
                </InputField>
            </div>
        </div>
    </div>
    <div slot="footer" class="footer-actions">
        <Button variant="outline" color="primary" size="lg" on:click={closeAddModal}>
            Cancel
        </Button>
        <Button variant="filled" color="primary" size="lg" loading={addLoading} on:click={handleAddMember}>
            Add
        </Button>
    </div>
</Modal>

<!-- Edit Member Modal (shared component) -->
<EditMemberModal
    bind:open={showEditModal}
    member={editTarget ? { id: editTarget.id, name: editTarget.name, email: editTarget.email, accountRole: editTarget.role, status: editTarget.status } : null}
    loading={editLoading}
    on:close={closeEditModal}
    on:save={handleEditSave}
/>

<!-- Delete Member ConfirmModal -->
<ConfirmModal
    open={showDeleteModal}
    title="Delete Member"
    description="Are you sure you want to delete this member? This action can not be reverse."
    cancelText="Cancel"
    confirmText="Delete"
    type="error"
    confirmLoading={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={handleDelete}
/>

<!-- Deactivate Member ConfirmModal -->
<ConfirmModal
    open={showDeactivateModal}
    title="Deactivate Member"
    description="Are you sure you want to deactivate this member?"
    cancelText="Cancel"
    confirmText="Deactivate"
    type="error"
    confirmLoading={deactivateLoading}
    on:close={closeDeactivateModal}
    on:confirm={handleDeactivate}
/>

<!-- Reactivate Member ConfirmModal -->
<ConfirmModal
    open={showReactivateModal}
    title="Reactivate Member"
    description="Are you sure you want to reactivate this member?"
    cancelText="Cancel"
    confirmText="Reactivate"
    type="info"
    confirmLoading={reactivateLoading}
    on:close={closeReactivateModal}
    on:confirm={handleReactivate}
/>

{#if userForDialog}
    <PasswordUpdateDialog
        bind:open={passwordDialogOpen}
        user={userForDialog}
        action="?/updatePassword"
        onSuccess={() => {
            passwordDialogOpen = false;
            selectedUser = null;
        }}
    />
    <ResetPasswordDialog
        bind:open={resetDialogOpen}
        user={userForDialog}
        action="?/resetPassword"
        onSuccess={() => {
            resetDialogOpen = false;
            selectedUser = null;
            invalidateAll();
        }}
    />
{/if}

<style>
    .members-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
        background: var(--ds-bg-secondary);
        padding: var(--ds-space-6);
        gap: var(--ds-space-6);
    }

    .toolbar {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-4);
    }

    .search-wrapper {
        flex: 1;
        max-width: 480px;
    }

    .actions-wrapper {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
    }

    .table-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .form-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--ds-space-4);
    }

    .form-col {
        min-width: 0;
    }

    /* Account Role + Active side by side in right column; align to same baseline */
    .form-col-role-active {
        display: flex;
        flex-direction: row;
        align-items: flex-end;
        gap: var(--ds-space-4);
    }

    .form-col-role-active .dropdown-field {
        flex: 1;
        min-width: 0;
    }

    .form-col-role-active .toggle-field {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        padding-bottom: var(--ds-space-0-5);
        min-width: 120px;
    }

    .dropdown-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1-5);
    }

    .toggle-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1-5);
    }

    /* Active: toggle left, label right; vertical center alignment */
    .toggle-field-inline {
        flex-direction: row;
        align-items: center;
        justify-content: flex-start;
        gap: var(--ds-space-2);
        min-height: 44px;
    }

    .toggle-field-inline .field-label {
        margin: 0;
        white-space: nowrap;
    }

    .password-toggle-btn {
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

    .password-toggle-btn:hover {
        color: var(--ds-text-primary);
    }

    .field-label {
        font: var(--ds-text-sm-medium);
        color: var(--ds-text-secondary);
    }

    /* Modal footer: align with design-system (flex-end, gap 16px) */
    .footer-actions {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        gap: var(--ds-space-4);
        width: 100%;
    }
</style>
