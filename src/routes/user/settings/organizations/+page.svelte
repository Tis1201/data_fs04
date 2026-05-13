<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { toast } from '$lib/stores/alertToast';
    import { 
        Button, 
        InputField, 
        TextareaField,
        DataTable, 
        Modal, 
        Dropdown,
        ConfirmModal,
        PhoneInput
    } from '$lib/design-system/components';
    import type { ColumnDef, PaginationState, BadgeColor } from '$lib/design-system/components';
    import { Search, Plus, Pencil } from 'lucide-svelte';
    import type { PageData } from './$types';
    import { DESCRIPTION_MAX } from '$lib/constants/description';

    export let data: PageData;

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

    // State
    $: organizations = (data.organizations || []) as OrganizationRow[];
    $: currentAccount = data.currentAccount;

    let loading = false;
    let searchValue = $page.url.searchParams.get('search') || '';
    let searchTimeout: ReturnType<typeof setTimeout>;

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
                    onClick: () => openEditModal(row)
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

    // Pagination
    function handlePageChange(event: CustomEvent<number>) {
        const url = new URL($page.url);
        url.searchParams.set('page', String(event.detail));
        goto(url.pathname + url.search, { noScroll: true });
    }

    // Sort
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

    // Row click - navigate to detail
    function handleRowClick(event: CustomEvent<{ row: OrganizationRow }>) {
        goto(`/user/settings/organizations/${event.detail.row.id}`);
    }

    // =========================
    // Add/Edit Modal
    // =========================
    let showAddModal = false;
    let showEditModal = false;
    let editingOrg: OrganizationRow | null = null;
    let formLoading = false;

    // Form state
    let formName = '';
    let formEmail = '';
    let formPhone = '';
    let formAddress = '';
    let formDescription = '';

    function openAddModal() {
        formName = '';
        formEmail = '';
        formPhone = '';
        formAddress = '';
        formDescription = '';
        showAddModal = true;
    }

    function openEditModal(org: OrganizationRow) {
        editingOrg = org;
        formName = org.name;
        formEmail = org.contactEmail || '';
        formPhone = org.contactPhone || '';
        formAddress = org.address || '';
        formDescription = org.description || '';
        showEditModal = true;
    }

    function closeAddModal() {
        showAddModal = false;
    }

    function closeEditModal() {
        showEditModal = false;
        editingOrg = null;
    }

    async function handleAdd() {
        if (!formName.trim()) {
            toast.error('Organization name is required');
            return;
        }
        if (!formEmail.trim()) {
            toast.error('Contact email is required');
            return;
        }

        formLoading = true;
        try {
            const fd = new FormData();
            fd.set('name', formName);
            fd.set('contactEmail', formEmail);
            fd.set('contactPhone', formPhone);
            fd.set('address', formAddress);
            fd.set('description', formDescription);

            const res = await fetch('?/create', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Organization added successfully!');
                closeAddModal();
                await invalidate('app:organizations');
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.error || 'Unable to add Organization. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to add Organization. Please try again!');
        } finally {
            formLoading = false;
        }
    }

    async function handleEdit() {
        if (!editingOrg) return;
        if (!formName.trim()) {
            toast.error('Organization name is required');
            return;
        }
        if (!formEmail.trim()) {
            toast.error('Contact email is required');
            return;
        }

        formLoading = true;
        try {
            const fd = new FormData();
            fd.set('id', editingOrg.id);
            fd.set('name', formName);
            fd.set('contactEmail', formEmail);
            fd.set('contactPhone', formPhone);
            fd.set('address', formAddress);
            fd.set('description', formDescription);

            const res = await fetch('?/update', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Profile updated successfully!');
                closeEditModal();
                await invalidate('app:organizations');
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.error || 'Unable to update Profile. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to update Profile. Please try again!');
        } finally {
            formLoading = false;
        }
    }

    // =========================
    // Deactivate/Reactivate Modal
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

            const res = await fetch('?/toggleStatus', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success(`Organization ${action} successfully!`);
                closeToggleStatusModal();
                await invalidate('app:organizations');
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.error || `Unable to ${action.slice(0, -1)} Organization. Please try again!`);
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

            const res = await fetch('?/delete', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Organization deleted successfully!');
                closeDeleteModal();
                await invalidate('app:organizations');
                goto($page.url.pathname + $page.url.search, { noScroll: true, invalidateAll: true });
            } else {
                toast.error(result.data?.error || 'Unable to delete Organization. Please try again!');
            }
        } catch (err) {
            toast.error('Unable to delete Organization. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }
</script>

<div class="organizations-page">
    <!-- Toolbar -->
    <div class="toolbar">
        <div class="search-wrapper">
            <InputField
                placeholder="Search by name"
                bind:value={searchValue}
                on:input={handleSearch}
                prefixIcon={true}
            >
                <Search slot="prefix-icon" size={20} />
            </InputField>
        </div>
        <div class="actions-wrapper">
            <Button
                variant="filled"
                color="primary"
                size="lg"
                icon={Plus}
                iconPosition="left"
                on:click={openAddModal}
            >
                Add Organization
            </Button>
        </div>
    </div>

    <!-- Table -->
    <div class="table-wrapper">
        <DataTable
            data={organizations}
            {columns}
            {pagination}
            {sort}
            {loading}
            emptyMessage="No organizations found"
            on:sort={handleSort}
            on:pageChange={handlePageChange}
            on:rowClick={handleRowClick}
        />
    </div>
</div>

<!-- Add Organization Modal -->
<Modal
    open={showAddModal}
    title="Add Organization"
    width="880px"
    on:close={closeAddModal}
>
    <div class="form-body">
        <div class="form-row">
            <InputField
                label="Organization Name"
                placeholder="Enter"
                bind:value={formName}
                required={true}
            />
            <div class="dropdown-field">
                <span class="field-label">Account</span>
                <Dropdown
                    options={[{ id: currentAccount?.id || '', label: currentAccount?.name || 'System Account' }]}
                    value={currentAccount?.id || ''}
                    disabled={true}
                />
            </div>
        </div>
        <div class="form-row">
            <InputField
                label="Contact Email"
                placeholder="Enter"
                type="email"
                bind:value={formEmail}
                required={true}
            />
            <PhoneInput
                label="Contact Phone Number"
                placeholder="### ###-####"
                bind:value={formPhone}
            />
        </div>
        <InputField
            label="Address"
            placeholder="Enter"
            bind:value={formAddress}
        />
        <TextareaField
            label="Description"
            placeholder="Enter"
            bind:value={formDescription}
            rows={4}
            maxlength={DESCRIPTION_MAX}
        />
        <p class="char-count" class:char-count-limit={(formDescription?.length ?? 0) === DESCRIPTION_MAX}>
            {formDescription?.length ?? 0}/{DESCRIPTION_MAX} characters
        </p>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="outline" color="primary" size="lg" on:click={closeAddModal}>
            Cancel
        </Button>
        <Button variant="filled" color="primary" size="lg" loading={formLoading} on:click={handleAdd}>
            Add
        </Button>
    </svelte:fragment>
</Modal>

<!-- Edit Organization Modal -->
<Modal
    open={showEditModal}
    title="Edit Organization"
    width="880px"
    on:close={closeEditModal}
>
    <div class="form-body">
        <div class="form-row">
            <InputField
                label="Organization Name"
                placeholder="Enter"
                bind:value={formName}
                required={true}
            />
            <div class="dropdown-field">
                <span class="field-label">Account</span>
                <Dropdown
                    options={[{ id: currentAccount?.id || '', label: currentAccount?.name || 'System Account' }]}
                    value={currentAccount?.id || ''}
                    disabled={true}
                />
            </div>
        </div>
        <div class="form-row">
            <InputField
                label="Contact Email"
                placeholder="Enter"
                type="email"
                bind:value={formEmail}
                required={true}
            />
            <PhoneInput
                label="Contact Phone Number"
                placeholder="### ###-####"
                bind:value={formPhone}
            />
        </div>
        <InputField
            label="Address"
            placeholder="Enter"
            bind:value={formAddress}
        />
        <TextareaField
            label="Description"
            placeholder="Enter"
            bind:value={formDescription}
            rows={4}
            maxlength={DESCRIPTION_MAX}
        />
        <p class="char-count" class:char-count-limit={(formDescription?.length ?? 0) === DESCRIPTION_MAX}>
            {formDescription?.length ?? 0}/{DESCRIPTION_MAX} characters
        </p>
    </div>
    <svelte:fragment slot="footer">
        <Button variant="outline" color="primary" size="lg" on:click={closeEditModal}>
            Cancel
        </Button>
        <Button variant="filled" color="primary" size="lg" loading={formLoading} on:click={handleEdit}>
            Save
        </Button>
    </svelte:fragment>
</Modal>

<!-- Deactivate/Reactivate Confirmation Modal -->
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
    .organizations-page {
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
