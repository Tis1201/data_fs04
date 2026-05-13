<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { toast } from '$lib/stores/alertToast';
    import {
        Button,
        Card,
        InputField,
        TextareaField,
        DataTable,
        Modal,
        Dropdown,
        ConfirmModal,
        PhoneInput,
        TabGroup
    } from '$lib/design-system/components';
    import type { ColumnDef, PaginationState, BadgeColor, TabItem } from '$lib/design-system/components';
    import { DESCRIPTION_MAX } from '$lib/constants/description';
    import { Info, Pencil, Plus, Building2 } from 'lucide-svelte';
    import type { PageData } from './$types';

    export let data: PageData;

    // Reactive data
    $: account = data.account;
    $: organizations = (data.organizations || []) as OrganizationRow[];

    // Types
    interface OrganizationRow {
        id: string;
        name: string;
        contactEmail: string | null;
        totalDevices: number;
        address: string | null;
        status: string;
        createdAt: string;
        updatedAt: string;
        description: string | null;
        contactPhone: string | null;
    }

    // Tab state
    const tabs: TabItem[] = [
        { id: 'companies', label: 'Assigned Companies' },
        { id: 'notifications', label: 'Notifications' },
        { id: 'security', label: 'Security' }
    ];
    let activeTab = 'companies';

    // Loading state
    let loading = false;

    // Pagination
    let pagination: PaginationState = {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0
    };

    $: if (data.meta) {
        pagination = {
            page: data.meta.currentPage,
            pageSize: data.meta.itemsPerPage,
            totalItems: data.meta.totalItems,
            totalPages: data.meta.totalPages
        };
    }

    // Sort
    let sort = {
        field: data.sort?.field || 'name',
        direction: (data.sort?.order || 'asc') as 'asc' | 'desc' | null
    };

    // Table columns
    const columns: ColumnDef<OrganizationRow>[] = [
        {
            id: 'name',
            header: 'Name',
            type: 'textWithSupporting',
            accessor: 'name',
            supportingField: 'contactEmail',
            sortable: true,
            width: '25%'
        },
        {
            id: 'totalDevices',
            header: 'Total Devices',
            accessor: 'totalDevices',
            sortable: true,
            width: '12%',
            align: 'left'
        },
        {
            id: 'address',
            header: 'Address',
            accessor: (row: OrganizationRow) => row.address || '-',
            width: '30%'
        },
        {
            id: 'status',
            header: 'Status',
            type: 'badge',
            accessor: (row: OrganizationRow) => row.status === 'ACTIVE' ? 'Active' : 'Inactive',
            sortable: true,
            width: '12%',
            statusColor: (_value: any, row: OrganizationRow): BadgeColor => {
                return row.status === 'ACTIVE' ? 'success' : 'gray';
            },
            showDot: () => true
        },
        {
            id: 'actions',
            header: 'Actions',
            type: 'moreMenu',
            width: '10%',
            align: 'center',
            getMenuActions: (row: OrganizationRow) => [
                {
                    id: 'edit',
                    label: 'Edit',
                    onClick: () => openEditOrgModal(row)
                },
                {
                    id: 'toggle-status',
                    label: row.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate',
                    onClick: () => openToggleStatusModal(row)
                },
                {
                    id: 'delete',
                    label: 'Delete',
                    destructive: true,
                    onClick: () => openDeleteModal(row)
                }
            ]
        }
    ];

    // Search
    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

    function handleSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const url = new URL($page.url);
            if (searchValue.trim()) {
                url.searchParams.set('search', searchValue.trim());
            } else {
                url.searchParams.delete('search');
            }
            url.searchParams.set('page', '1');
            goto(url.pathname + url.search, { noScroll: true });
        }, 300);
    }

    // Pagination handler
    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    // Sort handler
    function handleSort(event: CustomEvent<{ field: string | null; direction: 'asc' | 'desc' | null }>) {
        sort = {
            field: event.detail.field || 'name',
            direction: event.detail.direction
        };
        const url = new URL($page.url);
        if (sort.field) {
            url.searchParams.set('sort_field', sort.field);
            url.searchParams.set('sort_order', sort.direction || 'asc');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search, { noScroll: true });
    }

    // =========================
    // Edit Profile Modal
    // =========================
    let showEditProfileModal = false;
    let editProfileLoading = false;
    let profileName = '';
    let profileDescription = '';
    let profileNameError = '';

    function openEditProfileModal() {
        profileName = account?.name || '';
        profileDescription = account?.description || '';
        profileNameError = '';
        showEditProfileModal = true;
    }

    function closeEditProfileModal() {
        showEditProfileModal = false;
        profileNameError = '';
    }

    async function handleEditProfile() {
        profileNameError = '';
        if (!profileName.trim()) {
            profileNameError = 'Account name is required';
            return;
        }

        editProfileLoading = true;
        try {
            const fd = new FormData();
            fd.set('name', profileName);
            fd.set('description', profileDescription);

            const res = await fetch('?/updateProfile', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success' || result.data?.form?.message?.type === 'success') {
                toast.success('Profile updated successfully!');
                closeEditProfileModal();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(getActionError(result, 'Unable to update profile. Please try again!'));
            }
        } catch (err) {
            toast.error('Unable to update profile. Please try again!');
        } finally {
            editProfileLoading = false;
        }
    }

    // =========================
    // Add/Edit Organization Modal
    // =========================
    let showAddOrgModal = false;
    let showEditOrgModal = false;
    let editingOrg: OrganizationRow | null = null;
    let orgFormLoading = false;

    // Form state
    let orgName = '';
    let orgEmail = '';
    let orgPhone = '';
    let orgAddress = '';
    let orgDescription = '';

    // Inline field errors (show under field, not toast)
    let orgNameError = '';
    let orgEmailError = '';

    function clearOrgFieldErrors() {
        orgNameError = '';
        orgEmailError = '';
    }

    function openAddOrgModal() {
        orgName = '';
        orgEmail = '';
        orgPhone = '';
        orgAddress = '';
        orgDescription = '';
        clearOrgFieldErrors();
        showAddOrgModal = true;
    }

    function closeAddOrgModal() {
        showAddOrgModal = false;
        clearOrgFieldErrors();
    }

    function openEditOrgModal(org: OrganizationRow) {
        editingOrg = org;
        orgName = org.name;
        orgEmail = org.contactEmail || '';
        orgPhone = org.contactPhone || '';
        orgAddress = org.address || '';
        orgDescription = org.description || '';
        clearOrgFieldErrors();
        showEditOrgModal = true;
    }

    function closeEditOrgModal() {
        showEditOrgModal = false;
        editingOrg = null;
        clearOrgFieldErrors();
    }

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    /** Extract error message from action failure (handles { data: object }, { data: string }, JSON-string data) */
    function getActionError(result: { data?: unknown }, fallback: string): string {
        const d = result.data;
        if (typeof d === 'string') {
            try {
                const parsed = JSON.parse(d) as unknown;
                if (Array.isArray(parsed) && typeof parsed[1] === 'string') return parsed[1];
                if (parsed && typeof (parsed as Record<string, unknown>).error === 'string')
                    return (parsed as Record<string, string>).error;
            } catch {
                return d || fallback;
            }
        }
        if (d && typeof d === 'object' && typeof (d as Record<string, unknown>).error === 'string') {
            return (d as Record<string, string>).error;
        }
        return fallback;
    }

    async function handleAddOrg() {
        clearOrgFieldErrors();
        let hasError = false;
        if (!orgName.trim()) {
            orgNameError = 'Organization name is required';
            hasError = true;
        }
        if (!orgEmail.trim()) {
            orgEmailError = 'Contact email is required';
            hasError = true;
        } else if (!EMAIL_REGEX.test(orgEmail)) {
            orgEmailError = 'Please enter a valid email address (e.g. name@example.com)';
            hasError = true;
        }
        if (hasError) return;

        orgFormLoading = true;
        try {
            const fd = new FormData();
            fd.set('name', orgName);
            fd.set('contactEmail', orgEmail);
            fd.set('contactPhone', orgPhone);
            fd.set('address', orgAddress);
            fd.set('description', orgDescription);

            const res = await fetch('?/createOrganization', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Organization added successfully!');
                closeAddOrgModal();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                const err = getActionError(result, 'Unable to add Organization. Please try again!');
                if (err.includes('name already exists')) {
                    orgNameError = err;
                } else if (err.includes('contact email already exists') || err.includes('Invalid email format')) {
                    orgEmailError = err;
                } else {
                    toast.error(err);
                }
            }
        } catch (err) {
            toast.error('Unable to add Organization. Please try again!');
        } finally {
            orgFormLoading = false;
        }
    }

    async function handleEditOrg() {
        if (!editingOrg) return;
        clearOrgFieldErrors();
        let hasError = false;
        if (!orgName.trim()) {
            orgNameError = 'Organization name is required';
            hasError = true;
        }
        if (!orgEmail.trim()) {
            orgEmailError = 'Contact email is required';
            hasError = true;
        } else if (!EMAIL_REGEX.test(orgEmail)) {
            orgEmailError = 'Please enter a valid email address (e.g. name@example.com)';
            hasError = true;
        }
        if (hasError) return;

        orgFormLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', editingOrg.id);
            fd.set('name', orgName);
            fd.set('contactEmail', orgEmail);
            fd.set('contactPhone', orgPhone);
            fd.set('address', orgAddress);
            fd.set('description', orgDescription);

            const res = await fetch('?/updateOrganization', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Organization updated successfully!');
                closeEditOrgModal();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                const err = getActionError(result, 'Unable to update Organization. Please try again!');
                if (err.includes('name already exists')) {
                    orgNameError = err;
                } else if (err.includes('contact email already exists') || err.includes('Invalid email format')) {
                    orgEmailError = err;
                } else {
                    toast.error(err);
                }
            }
        } catch (err) {
            toast.error('Unable to update Organization. Please try again!');
        } finally {
            orgFormLoading = false;
        }
    }

    // =========================
    // Toggle Status Modal
    // =========================
    let showToggleStatusModal = false;
    let toggleStatusOrg: OrganizationRow | null = null;
    let toggleStatusLoading = false;

    function openToggleStatusModal(org: OrganizationRow) {
        toggleStatusOrg = org;
        showToggleStatusModal = true;
    }

    function closeToggleStatusModal() {
        showToggleStatusModal = false;
        toggleStatusOrg = null;
    }

    async function handleToggleStatus() {
        if (!toggleStatusOrg) return;

        toggleStatusLoading = true;
        const newStatus = toggleStatusOrg.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const action = newStatus === 'ACTIVE' ? 'reactivated' : 'deactivated';

        try {
            const fd = new FormData();
            fd.set('id', toggleStatusOrg.id);
            fd.set('status', newStatus);

            const res = await fetch('?/toggleOrganizationStatus', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success(`Organization ${action} successfully!`);
                closeToggleStatusModal();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(getActionError(result, `Unable to ${action.slice(0, -1)} Organization. Please try again!`));
            }
        } catch (err) {
            toast.error(`Unable to ${action.slice(0, -1)} Organization. Please try again!`);
        } finally {
            toggleStatusLoading = false;
        }
    }

    // =========================
    // Delete Modal
    // =========================
    let showDeleteModal = false;
    let deleteOrg: OrganizationRow | null = null;
    let deleteLoading = false;

    function openDeleteModal(org: OrganizationRow) {
        deleteOrg = org;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        deleteOrg = null;
    }

    async function handleDelete() {
        if (!deleteOrg) return;

        deleteLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', deleteOrg.id);

            const res = await fetch('?/deleteOrganization', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Organization deleted successfully!');
                closeDeleteModal();
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(getActionError(result, 'Unable to delete Organization. Please try again!'));
            }
        } catch (err) {
            toast.error('Unable to delete Organization. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    // Tab change handler
    function handleTabChange(event: CustomEvent<string>) {
        activeTab = event.detail;
    }
</script>

<div class="profile-page">
    <!-- Top row: Edit Profile button outside cards (aligned right, same row as header title in layout) -->
    <div class="profile-top-row">
        <div class="profile-top-spacer"></div>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            icon={Pencil}
            iconPosition="left"
            on:click={openEditProfileModal}
        >
            Edit Profile
        </Button>
    </div>

    <!-- Account Overview Section (same structure as template detail info-card) -->
    <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="info-card">
        <div slot="header" class="section-header">
            <div class="section-header-icon" aria-hidden="true">
                <Info class="icon-md" size={20} strokeWidth={1.5} />
            </div>
            <div class="section-header-content">
                <h2 class="section-title-sm">Account Overview</h2>
                <p class="section-subtitle">Manage your account details</p>
            </div>
        </div>
        <div class="info-card-body">
            <div class="info-grid-row">
                <div class="info-field">
                    <span class="info-label">Account Name</span>
                    <span class="info-value">{account?.name || '—'}</span>
                </div>
                <div class="info-field">
                    <span class="info-label">Account Slug</span>
                    <span class="info-value">{account?.slug || '—'}</span>
                </div>
                <div class="info-field">
                    <span class="info-label">Description</span>
                    <span class="info-value">{account?.description || '—'}</span>
                </div>
            </div>
        </div>
    </Card>

    <!-- Tabs -->
    <div class="tabs-section">
        <TabGroup
            {tabs}
            {activeTab}
            type="underline"
            size="md"
            on:change={handleTabChange}
        />
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'companies'}
        <!-- Assigned Organizations Section (same structure as template detail info-card with header action) -->
        <Card variant="default" radius="2xl" padding="md" fullWidth={true} class="info-card organizations-card">
            <div slot="header" class="section-header-row section-header-with-action">
                <div class="section-header">
                    <div class="section-header-icon" aria-hidden="true">
                        <Building2 class="icon-md" size={20} strokeWidth={1.5} />
                    </div>
                    <div class="section-header-content">
                        <h2 class="section-title-sm">Assigned Organizations</h2>
                        <p class="section-subtitle">Organizations associated with this account</p>
                    </div>
                </div>
                <Button
                    variant="filled"
                    color="primary"
                    size="lg"
                    icon={Plus}
                    iconPosition="left"
                    on:click={openAddOrgModal}
                >
                    Add Organization
                </Button>
            </div>
            <div class="organizations-card-body">
                <DataTable
                    data={organizations}
                    {columns}
                    {pagination}
                    {sort}
                    {loading}
                    bordered={true}
                    emptyMessage="No organizations found"
                    on:sort={handleSort}
                    on:pageChange={handlePageChange}
                />
            </div>
        </Card>
    {:else if activeTab === 'notifications'}
        <div class="placeholder-section">
            <p>Notifications settings coming soon...</p>
        </div>
    {:else if activeTab === 'security'}
        <div class="placeholder-section">
            <p>Security settings coming soon...</p>
        </div>
    {/if}
</div>

<!-- Edit Profile Modal -->
<Modal
    open={showEditProfileModal}
    title="Edit Profile"
    width="880px"
    on:close={closeEditProfileModal}
>
    <div class="form-body">
        <div class="form-row">
            <InputField
                label="Account Name"
                placeholder="Enter account name"
                bind:value={profileName}
                required={true}
                state={profileNameError ? 'error' : 'default'}
                helperText={profileNameError}
                on:input={() => (profileNameError = '')}
            />
            <InputField
                label="Account Slug"
                value={account?.slug || ''}
                disabled={true}
            />
        </div>
        <TextareaField
            label="Description"
            placeholder="Enter description"
            bind:value={profileDescription}
            rows={4}
            maxlength={DESCRIPTION_MAX}
        />
        <p class="char-count" class:char-count-limit={(profileDescription?.length ?? 0) === DESCRIPTION_MAX}>
            {profileDescription?.length ?? 0}/{DESCRIPTION_MAX} characters
        </p>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="outline" color="primary" size="lg" on:click={closeEditProfileModal}>
            Cancel
        </Button>
        <Button variant="filled" color="primary" size="lg" loading={editProfileLoading} on:click={handleEditProfile}>
            Save
        </Button>
    </svelte:fragment>
</Modal>

<!-- Add Organization Modal -->
<Modal
    open={showAddOrgModal}
    title="Add Organization"
    width="880px"
    on:close={closeAddOrgModal}
>
    <div class="form-body">
        <div class="form-row">
            <InputField
                label="Organization Name"
                placeholder="Enter"
                bind:value={orgName}
                required={true}
                state={orgNameError ? 'error' : 'default'}
                helperText={orgNameError}
                on:input={() => (orgNameError = '')}
            />
            <div class="dropdown-field">
                <span class="field-label">Account</span>
                <Dropdown
                    options={[{ id: account?.id || '', label: account?.name || 'System Account' }]}
                    value={account?.id || ''}
                    disabled={true}
                />
            </div>
        </div>
        <div class="form-row">
            <InputField
                label="Contact Email"
                placeholder="Enter"
                type="email"
                bind:value={orgEmail}
                required={true}
                state={orgEmailError ? 'error' : 'default'}
                helperText={orgEmailError}
                on:input={() => (orgEmailError = '')}
            />
            <PhoneInput
                label="Contact Phone Number"
                placeholder="### ###-####"
                bind:value={orgPhone}
            />
        </div>
        <InputField
            label="Address"
            placeholder="Enter"
            bind:value={orgAddress}
        />
        <TextareaField
            label="Description"
            placeholder="Enter"
            bind:value={orgDescription}
            rows={4}
            maxlength={DESCRIPTION_MAX}
        />
        <p class="char-count" class:char-count-limit={(orgDescription?.length ?? 0) === DESCRIPTION_MAX}>
            {orgDescription?.length ?? 0}/{DESCRIPTION_MAX} characters
        </p>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="outline" color="primary" size="lg" on:click={closeAddOrgModal}>
            Cancel
        </Button>
        <Button variant="filled" color="primary" size="lg" loading={orgFormLoading} on:click={handleAddOrg}>
            Add
        </Button>
    </svelte:fragment>
</Modal>

<!-- Edit Organization Modal -->
<Modal
    open={showEditOrgModal}
    title="Edit Organization"
    width="880px"
    on:close={closeEditOrgModal}
>
    <div class="form-body">
        <div class="form-row">
            <InputField
                label="Organization Name"
                placeholder="Enter"
                bind:value={orgName}
                required={true}
                state={orgNameError ? 'error' : 'default'}
                helperText={orgNameError}
                on:input={() => (orgNameError = '')}
            />
            <div class="dropdown-field">
                <span class="field-label">Account</span>
                <Dropdown
                    options={[{ id: account?.id || '', label: account?.name || 'System Account' }]}
                    value={account?.id || ''}
                    disabled={true}
                />
            </div>
        </div>
        <div class="form-row">
            <InputField
                label="Contact Email"
                placeholder="Enter"
                type="email"
                bind:value={orgEmail}
                required={true}
                state={orgEmailError ? 'error' : 'default'}
                helperText={orgEmailError}
                on:input={() => (orgEmailError = '')}
            />
            <PhoneInput
                label="Contact Phone Number"
                placeholder="### ###-####"
                bind:value={orgPhone}
            />
        </div>
        <InputField
            label="Address"
            placeholder="Enter"
            bind:value={orgAddress}
        />
        <TextareaField
            label="Description"
            placeholder="Enter"
            bind:value={orgDescription}
            rows={4}
            maxlength={DESCRIPTION_MAX}
        />
        <p class="char-count" class:char-count-limit={(orgDescription?.length ?? 0) === DESCRIPTION_MAX}>
            {orgDescription?.length ?? 0}/{DESCRIPTION_MAX} characters
        </p>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="outline" color="primary" size="lg" on:click={closeEditOrgModal}>
            Cancel
        </Button>
        <Button variant="filled" color="primary" size="lg" loading={orgFormLoading} on:click={handleEditOrg}>
            Save
        </Button>
    </svelte:fragment>
</Modal>

<!-- Toggle Status Confirmation Modal -->
<ConfirmModal
    open={showToggleStatusModal}
    title={toggleStatusOrg?.status === 'ACTIVE' ? 'Deactivate Organization' : 'Reactivate Organization'}
    description={toggleStatusOrg?.status === 'ACTIVE'
        ? 'Are you sure you want to deactivate this organization?'
        : 'Are you sure you want to reactivate this organization?'}
    cancelText="Cancel"
    confirmText={toggleStatusOrg?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
    type="error"
    confirmLoading={toggleStatusLoading}
    on:close={closeToggleStatusModal}
    on:confirm={handleToggleStatus}
/>

<!-- Delete Confirmation Modal -->
<ConfirmModal
    open={showDeleteModal}
    title="Delete Organization"
    description="Are you sure you want to delete this organization? This action can not be reverse."
    cancelText="Cancel"
    confirmText="Delete"
    type="error"
    confirmLoading={deleteLoading}
    on:close={closeDeleteModal}
    on:confirm={handleDelete}
/>

<style>
    .profile-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
        background: var(--ds-bg-secondary);
        padding: var(--ds-space-6);
        gap: var(--ds-space-6);
    }

    /* Edit Profile button row – outside cards, aligned right */
    .profile-top-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        width: 100%;
        min-height: 44px;
    }

    .profile-top-spacer {
        flex: 1;
    }

    /* Info card & section header – match template detail (info-card, card-header px-4 py-3 border-b) */
    .section-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .section-header-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: var(--ds-space-3);
        border-radius: var(--ds-radius-lg);
        color: var(--ds-color-neutral-true-400);
    }

    .section-header-icon :global(svg),
    .section-header-icon :global(.icon-md) {
        width: 20px;
        height: 20px;
    }

    .section-header-content {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-0-5);
    }

    .section-header-with-action .section-header-content {
        flex: 1;
        min-width: 0;
    }

    .section-title-sm {
        margin: 0;
        font: var(--ds-text-md-medium);
        color: var(--ds-text-primary);
    }

    .section-subtitle {
        margin: 0;
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .section-header-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        width: 100%;
    }

    .section-header-row.section-header-with-action {
        gap: var(--ds-space-4);
    }

    .info-card-body {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .info-grid-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--ds-space-6);
    }

    .info-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }

    .info-label {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .info-value {
        font: var(--ds-text-md-medium);
        color: var(--ds-text-primary);
    }

    .organizations-card-body {
        padding-top: 0;
    }

    /* Tabs */
    .tabs-section {
        border-bottom: 1px solid var(--ds-border-default);
    }


    /* Placeholder for other tabs */
    .placeholder-section {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-12);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-xl);
        border: 1px solid var(--ds-border-default);
    }

    .placeholder-section p {
        font: var(--ds-text-md-regular);
        color: var(--ds-text-tertiary);
    }

    /* Form styles */
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

    .dropdown-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1-5);
    }

    .field-label {
        font: var(--ds-text-sm-medium);
        color: var(--ds-text-secondary);
    }

    .char-count {
        margin: 4px 0 0;
        font-size: var(--ds-text-xs);
        color: var(--ds-color-neutral-true-500);
    }

    .char-count.char-count-limit {
        color: var(--ds-color-amber-600, #d97706);
    }
</style>
