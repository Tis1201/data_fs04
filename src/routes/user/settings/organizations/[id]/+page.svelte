<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { page } from '$app/stores';
    import { toast } from '$lib/stores/alertToast';
    import { 
        Button, 
        InputField, 
        TextareaField,
        Modal, 
        Dropdown,
        ConfirmModal,
        Badge,
        PhoneInput
    } from '$lib/design-system/components';
    import { ArrowLeft, Pencil, ToggleLeft, ToggleRight, Trash2 } from 'lucide-svelte';
    import type { PageData } from './$types';

    export let data: PageData;

    // Types
    interface Organization {
        id: string;
        name: string;
        contactEmail: string | null;
        contactPhone: string | null;
        address: string | null;
        description: string | null;
        status: string;
        createdAt: string;
        updatedAt: string;
        totalDevices: number;
    }

    $: organization = data.organization as Organization;
    $: currentAccount = data.currentAccount;

    // =========================
    // Edit Modal
    // =========================
    let showEditModal = false;
    let formLoading = false;

    // Form state
    let formName = '';
    let formEmail = '';
    let formPhone = '';
    let formAddress = '';
    let formDescription = '';

    function openEditModal() {
        formName = organization.name;
        formEmail = organization.contactEmail || '';
        formPhone = organization.contactPhone || '';
        formAddress = organization.address || '';
        formDescription = organization.description || '';
        showEditModal = true;
    }

    function closeEditModal() {
        showEditModal = false;
    }

    async function handleEdit() {
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

            const res = await fetch('?/update', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Profile updated successfully!');
                closeEditModal();
                await invalidate('app:organization');
                goto($page.url.pathname, { noScroll: true, invalidateAll: true });
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
    // Toggle Status Modal
    // =========================
    let showToggleStatusModal = false;
    let toggleStatusLoading = false;

    function openToggleStatusModal() {
        showToggleStatusModal = true;
    }

    function closeToggleStatusModal() {
        showToggleStatusModal = false;
    }

    async function handleToggleStatus() {
        toggleStatusLoading = true;
        const newStatus = organization.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        const action = newStatus === 'ACTIVE' ? 'reactivated' : 'deactivated';

        try {
            const fd = new FormData();
            fd.set('status', newStatus);

            const res = await fetch('?/toggleStatus', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success(`Organization ${action} successfully!`);
                closeToggleStatusModal();
                await invalidate('app:organization');
                goto($page.url.pathname, { noScroll: true, invalidateAll: true });
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
    let deleteLoading = false;

    function openDeleteModal() {
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
    }

    async function handleDelete() {
        deleteLoading = true;
        try {
            const fd = new FormData();
            const res = await fetch('?/delete', { method: 'POST', body: fd });
            
            // Will redirect on success
            const result = await res.json().catch(() => ({}));

            if (result.type === 'success') {
                toast.success('Organization deleted successfully!');
            } else {
                toast.error(result.data?.error || 'Unable to delete Organization. Please try again!');
            }
        } catch (err) {
            // Redirect may throw
            toast.error('Unable to delete Organization. Please try again!');
        } finally {
            deleteLoading = false;
        }
    }

    function goBack() {
        goto('/user/settings/organizations');
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

<div class="organization-detail-page">
    <!-- Header -->
    <div class="detail-header">
        <div class="header-left">
            <button class="back-button" on:click={goBack}>
                <ArrowLeft size={20} />
            </button>
            <div class="header-info">
                <h1 class="org-name">{organization.name}</h1>
                <Badge 
                    color={organization.status === 'ACTIVE' ? 'success' : 'gray'}
                    showDot={true}
                >
                    {organization.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </Badge>
            </div>
        </div>
        <div class="header-actions">
            <Button
                variant="outline"
                color="gray"
                size="lg"
                icon={Pencil}
                iconPosition="left"
                on:click={openEditModal}
            >
                Edit
            </Button>
            <Button
                variant="outline"
                color={organization.status === 'ACTIVE' ? 'gray' : 'primary'}
                size="lg"
                icon={organization.status === 'ACTIVE' ? ToggleLeft : ToggleRight}
                iconPosition="left"
                on:click={openToggleStatusModal}
            >
                {organization.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            </Button>
            <Button
                variant="outline"
                color="danger"
                size="lg"
                icon={Trash2}
                iconPosition="left"
                on:click={openDeleteModal}
            >
                Delete
            </Button>
        </div>
    </div>

    <!-- Detail Content -->
    <div class="detail-content">
        <div class="info-card">
            <h2 class="card-title">Organization Information</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Name</span>
                    <span class="info-value">{organization.name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Account</span>
                    <span class="info-value">{currentAccount?.name || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Contact Email</span>
                    <span class="info-value">{organization.contactEmail || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Contact Phone</span>
                    <span class="info-value">{organization.contactPhone || '-'}</span>
                </div>
                <div class="info-item full-width">
                    <span class="info-label">Address</span>
                    <span class="info-value">{organization.address || '-'}</span>
                </div>
                <div class="info-item full-width">
                    <span class="info-label">Description</span>
                    <span class="info-value">{organization.description || '-'}</span>
                </div>
            </div>
        </div>

        <div class="stats-card">
            <h2 class="card-title">Statistics</h2>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-value">{organization.totalDevices}</span>
                    <span class="stat-label">Total Devices</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">{formatDate(organization.createdAt)}</span>
                    <span class="stat-label">Created</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">{formatDate(organization.updatedAt)}</span>
                    <span class="stat-label">Last Updated</span>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Edit Modal -->
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
        />
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

<!-- Toggle Status Modal -->
<ConfirmModal
    open={showToggleStatusModal}
    title={organization?.status === 'ACTIVE' ? 'Deactivate Organization' : 'Reactivate Organization'}
    description={organization?.status === 'ACTIVE' 
        ? 'Are you sure you want to deactivate this organization?' 
        : 'Are you sure you want to reactivate this organization?'}
    cancelText="Cancel"
    confirmText={organization?.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
    type="error"
    confirmLoading={toggleStatusLoading}
    on:close={closeToggleStatusModal}
    on:confirm={handleToggleStatus}
/>

<!-- Delete Modal -->
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
    .organization-detail-page {
        display: flex;
        flex-direction: column;
        width: 100%;
        min-height: 100%;
        background: var(--ds-bg-secondary);
        padding: var(--ds-space-6);
        gap: var(--ds-space-6);
    }

    /* Header */
    .detail-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding: var(--ds-space-4) var(--ds-space-6);
        background: var(--ds-bg-primary);
        border-radius: var(--ds-radius-lg);
        border: 1px solid var(--ds-border-default);
    }

    .header-left {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-4);
    }

    .back-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--ds-radius-md);
        border: 1px solid var(--ds-border-default);
        background: var(--ds-bg-primary);
        color: var(--ds-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .back-button:hover {
        background: var(--ds-bg-secondary);
        color: var(--ds-text-primary);
    }

    .header-info {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
    }

    .org-name {
        font: var(--ds-heading-lg);
        color: var(--ds-text-primary);
        margin: 0;
    }

    .header-actions {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: var(--ds-space-3);
    }

    /* Content */
    .detail-content {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-6);
    }

    .info-card,
    .stats-card {
        background: var(--ds-bg-primary);
        border-radius: var(--ds-radius-lg);
        border: 1px solid var(--ds-border-default);
        padding: var(--ds-space-6);
    }

    .card-title {
        font: var(--ds-text-lg-semibold);
        color: var(--ds-text-primary);
        margin: 0 0 var(--ds-space-5) 0;
    }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--ds-space-5);
    }

    .info-item {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }

    .info-item.full-width {
        grid-column: 1 / -1;
    }

    .info-label {
        font: var(--ds-text-sm-regular);
        color: var(--ds-text-tertiary);
    }

    .info-value {
        font: var(--ds-text-md-medium);
        color: var(--ds-text-primary);
    }

    /* Stats */
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: var(--ds-space-6);
    }

    .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-4);
        background: var(--ds-bg-secondary);
        border-radius: var(--ds-radius-md);
    }

    .stat-value {
        font: var(--ds-heading-md);
        color: var(--ds-text-primary);
    }

    .stat-label {
        font: var(--ds-text-sm-regular);
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
</style>
