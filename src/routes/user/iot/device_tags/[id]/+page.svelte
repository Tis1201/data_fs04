<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { deserialize } from '$app/forms';
    import { page } from '$app/stores';
    import { Pencil, Info, HardDrive, Trash2, Plus, ChevronDown, ChevronUp, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-svelte';
    import { toast } from '$lib/stores/alertToast';
    import { api_delete } from '$lib/utils/ApiUtils';
    import { Button, Card, InputField, Badge, ActionMenu, ConfirmModal } from '$lib/design-system/components';
    import AddDeviceToTagModal from "$lib/components/ui_components_sveltekit/device_tags/AddDeviceToTagModal.svelte";
    import EditTagModal from "$lib/components/ui_components_sveltekit/device_tags/EditTagModal.svelte";
    
    export let data;
    $: deviceTag = data?.deviceTag;

    let showDeleteModal = false;
    let deleteTagLoading = false;
    let showEditTagModal = false;
    let editTagLoading = false;

    $: accounts = deviceTag?.account ? [{ id: deviceTag.account.id, name: deviceTag.account.name }] : [];
    $: editTagData = deviceTag ? {
        id: deviceTag.id,
        name: deviceTag.name,
        description: deviceTag.description,
        accountId: deviceTag.account?.id,
        accountName: deviceTag.account?.name
    } : null;

    function openEditTagModal() {
        showEditTagModal = true;
    }

    let editTagError = '';

    function closeEditTagModal() {
        showEditTagModal = false;
        editTagError = '';
    }

    /** Extract error message from action failure. Handles superforms devalue structure. */
    function getFormActionError(result: { data?: unknown }, fallback: string): string {
        const d = result.data;
        if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>;
            // Superforms: data.form.message = errorResponse { error: { message } }
            const form = o.form as Record<string, unknown> | undefined;
            const msg = form?.message as Record<string, unknown> | undefined;
            const errMsg = msg?.error as { message?: string } | undefined;
            if (typeof errMsg?.message === 'string') return errMsg.message;
            // Direct: data.message.error.message
            const topMsg = o.message as { error?: { message?: string } } | undefined;
            if (typeof topMsg?.error?.message === 'string') return topMsg.error.message;
            // Direct: data.error.message
            if (typeof o.error === 'string') return o.error;
            const err = o.error as { message?: string } | undefined;
            if (err && typeof err.message === 'string') return err.message;
            if (typeof o.message === 'string') return o.message;
            // Fallback: recursively find error.message in nested structure
            const found = findErrorMessage(o);
            if (found) return found;
        }
        return fallback;
    }

    function findErrorMessage(obj: unknown): string | null {
        if (!obj || typeof obj !== 'object') return null;
        const r = obj as Record<string, unknown>;
        if (typeof r.message === 'string' && (r.error || r.code)) return r.message;
        if (r.error && typeof r.error === 'object') {
            const m = (r.error as { message?: string }).message;
            if (typeof m === 'string') return m;
        }
        for (const v of Object.values(r)) {
            const found = findErrorMessage(v);
            if (found) return found;
        }
        return null;
    }

    /** Fallback: extract known error message from devalue string when structure is opaque */
    function extractErrorFromDevalueString(text: string): string | null {
        const known = [
            'Device tag with this name already exists',
            'Device tag not found',
            'You do not have permission',
            'No current account selected'
        ];
        for (const msg of known) {
            if (text.includes(msg)) return msg;
        }
        return null;
    }

    async function handleEditTag(event: CustomEvent<{ id: string; name: string; description: string; accountId: string }>) {
        const { name, description } = event.detail;
        editTagError = '';
        editTagLoading = true;

        try {
            const fd = new FormData();
            fd.set('name', name);
            fd.set('description', description);

            const res = await fetch('?/updateTag', { method: 'POST', body: fd });
            const text = await res.text();
            let result: { type?: string; data?: unknown };
            try {
                result = deserialize(text) as { type: string; data?: unknown };
            } catch {
                result = JSON.parse(text) as { type?: string; data?: unknown };
            }

            if (result?.type === 'failure' && 'data' in result) {
                const err = getFormActionError(result, 'Unable to update Tag. Please try again!');
                const displayErr = err === 'Unable to update Tag. Please try again!' ? (extractErrorFromDevalueString(text) || err) : err;
                editTagError = displayErr;
                toast.error(displayErr);
                return;
            }

            if (result?.type === 'success') {
                toast.success('Tag updated successfully!');
                closeEditTagModal();
                await invalidate('app:deviceTag');
            } else {
                const fallback = extractErrorFromDevalueString(text);
                editTagError = fallback || 'Unable to update Tag. Please try again!';
                toast.error(editTagError);
            }
        } catch {
            editTagError = 'Unable to update Tag. Please try again!';
            toast.error(editTagError);
        } finally {
            editTagLoading = false;
        }
    }

    function openDeleteConfirm() {
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
    }

    async function handleDeleteConfirm() {
        deleteTagLoading = true;
        try {
            await api_delete('/user/iot/device_tags', deviceTag.id);
            toast.success('Tag deleted successfully!');
            goto('/user/iot/device_tags');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Unable to delete Tag. Please try again!');
        } finally {
            deleteTagLoading = false;
        }
    }

    function formatDate(d: Date | string | null | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    let showAddDeviceModal = false;
    function openAddDeviceModal() { showAddDeviceModal = true; }
    function closeAddDeviceModal() { showAddDeviceModal = false; }
    async function onAddDeviceAdded() {
        await invalidate('app:deviceTag');
    }
    $: excludeDeviceIds = (deviceTag?.devices || []).map((d: { id: string }) => d.id);

    function formatLastSeen(d: Date | string | null | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        return formatDate(d);
    }

    const DEVICES_PAGE_SIZE = 10;
    let devicesPage = 1;
    let deviceSearchTerm = '';
    let devicesSort: { field: string | null; direction: 'asc' | 'desc' } = { field: null, direction: 'asc' };
    let openMoreMenuKey: string | null = null;
    let deviceToRemove: { id: string; name: string } | null = null;
    let confirmRemoveDeviceOpen = false;
    let removeDeviceLoading = false;

    $: deviceRows = (deviceTag?.devices || []).map((d: { id: string; name: string; deviceType?: string | null; status?: string; macAddress?: string | null; connected?: boolean; lastUsedAt?: Date | string | null }) => ({
        id: d.id,
        name: d.name,
        deviceType: d.deviceType ?? '—',
        status: d.connected ? 'ACTIVE' : 'INACTIVE',
        macAddress: d.macAddress || '—',
        lastUsedAt: d.lastUsedAt ?? null
    }));
    $: filteredDeviceRows = (() => {
        const rows = deviceSearchTerm.trim()
            ? deviceRows.filter((r: { name: string; macAddress: string }) =>
                r.name.toLowerCase().includes(deviceSearchTerm.toLowerCase()) ||
                r.macAddress.toLowerCase().includes(deviceSearchTerm.toLowerCase())
            )
            : deviceRows;
        if (!devicesSort.field) return rows;
        const f = devicesSort.field;
        const asc = devicesSort.direction === 'asc';
        return [...rows].sort((a: any, b: any) => {
            let va: string | number | null, vb: string | number | null;
            switch (f) {
                case 'name': va = (a.name ?? '').toLowerCase(); vb = (b.name ?? '').toLowerCase(); break;
                case 'macAddress': va = (a.macAddress ?? '').toLowerCase(); vb = (b.macAddress ?? '').toLowerCase(); break;
                case 'deviceType': va = (a.deviceType ?? '').toLowerCase(); vb = (b.deviceType ?? '').toLowerCase(); break;
                case 'status': va = (a.status ?? '').toLowerCase(); vb = (b.status ?? '').toLowerCase(); break;
                case 'lastUsedAt': va = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0; vb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0; break;
                default: return 0;
            }
            if (va === null && vb === null) return 0;
            if (va === null) return asc ? 1 : -1;
            if (vb === null) return asc ? -1 : 1;
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return asc ? cmp : -cmp;
        });
    })();
    $: devicesTotalItems = filteredDeviceRows.length;
    $: devicesTotalPages = Math.max(1, Math.ceil(devicesTotalItems / DEVICES_PAGE_SIZE));
    $: paginatedDeviceRows = filteredDeviceRows.slice(
        (devicesPage - 1) * DEVICES_PAGE_SIZE,
        devicesPage * DEVICES_PAGE_SIZE
    );
    $: devicesRangeStart = devicesTotalItems === 0 ? 0 : (devicesPage - 1) * DEVICES_PAGE_SIZE + 1;
    $: devicesRangeEnd = Math.min(devicesPage * DEVICES_PAGE_SIZE, devicesTotalItems);

    function handleDevicesSort(field: string) {
        if (devicesSort.field === field) {
            devicesSort = devicesSort.direction === 'asc'
                ? { field, direction: 'desc' }
                : { field: null, direction: 'asc' };
        } else {
            devicesSort = { field, direction: 'asc' };
        }
        devicesPage = 1;
    }
    function devicesPrevPage() { if (devicesPage > 1) devicesPage -= 1; }
    function devicesNextPage() { if (devicesPage < devicesTotalPages) devicesPage += 1; }
    function devicesFirstPage() { devicesPage = 1; }
    function devicesLastPage() { devicesPage = devicesTotalPages; }

    function getDeviceMenuActions(row: { id: string; name: string }) {
        return [
            { id: 'view', label: 'View', destructive: false, href: `/user/iot/devices/${row.id}` },
            { id: 'remove', label: 'Remove', destructive: true }
        ];
    }

    function handleDeviceActionSelect(row: { id: string; name: string }, itemId: string) {
        if (itemId === 'view') {
            // View is a link (href) in ActionMenu — no goto needed
            return;
        } else if (itemId === 'remove') {
            deviceToRemove = row;
            confirmRemoveDeviceOpen = true;
        }
    }

    async function handleConfirmRemoveDevice() {
        if (!deviceToRemove || !deviceTag?.id) return;
        removeDeviceLoading = true;
        try {
            const res = await fetch(`/api/v2/devices/${deviceToRemove.id}/tags/${deviceTag.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to remove device from tag');
            toast.success('Device removed from tag');
            confirmRemoveDeviceOpen = false;
            deviceToRemove = null;
            await invalidate('app:deviceTag');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to remove device from tag');
        } finally {
            removeDeviceLoading = false;
        }
    }
</script>

<div class="tag-detail">
    <div class="detail-buttons">
        <div class="detail-buttons-row">
            <Button
                variant="filled"
                color="danger"
                size="lg"
                iconLeft={true}
                on:click={openDeleteConfirm}
                style="height: 44px;"
            >
                <Trash2 size={20} slot="icon-left" />
                Delete
            </Button>
            <Button
                variant="filled"
                color="primary"
                size="lg"
                iconLeft={true}
                on:click={openEditTagModal}
                style="height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
            >
                <Pencil size={20} slot="icon-left" />
                Edit Tag
            </Button>
        </div>
    </div>

    <div class="detail-grid">
        <Card variant="default" padding="none" radius="2xl" showHeader={true} fullWidth={true}>
            <div slot="header" class="overview-header">
                <div class="overview-header-left">
                    <div class="overview-header-icon">
                        <Info size={20} />
                    </div>
                    <div class="overview-header-text">
                        <h3 class="overview-title">Tag Overview</h3>
                        <p class="overview-subtitle">Key information about this tag.</p>
                    </div>
                </div>
            </div>
            <div class="overview-body">
                <div class="overview-grid">
                    <div class="overview-field">
                        <span class="overview-label">Tag Name</span>
                        <span class="overview-value overview-value-truncate" title={deviceTag?.name || undefined}>{deviceTag?.name || '—'}</span>
                    </div>
                    <div class="overview-field overview-field-desc">
                        <span class="overview-label">Description</span>
                        <span class="overview-value overview-value-desc" title={deviceTag?.description || undefined}>{deviceTag?.description || '—'}</span>
                    </div>
                    <div class="overview-field">
                        <span class="overview-label">Account</span>
                        <span class="overview-value">{deviceTag?.account?.name ?? '—'}</span>
                    </div>
                    <div class="overview-field">
                        <span class="overview-label">Created</span>
                        <span class="overview-value">{formatDate(deviceTag?.createdAt)}</span>
                    </div>
                    <div class="overview-field">
                        <span class="overview-label">Last updated</span>
                        <span class="overview-value">{formatDate(deviceTag?.updatedAt)}</span>
                    </div>
                </div>
            </div>
        </Card>
    </div>

    <Card variant="default" padding="none" radius="2xl" showHeader={true} fullWidth={true} headerDivider={false}>
        <div slot="header" class="devices-header">
            <div class="devices-header-icon">
                <HardDrive size={20} />
            </div>
            <div class="devices-header-text">
                <h3 class="overview-title">Devices</h3>
                <p class="overview-subtitle">Devices assigned to this tag.</p>
            </div>
            <div class="devices-header-actions">
                <Button
                    variant="filled"
                    color="primary"
                    size="lg"
                    iconLeft={true}
                    on:click={openAddDeviceModal}
                    style="height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
                >
                    <Plus size={20} slot="icon-left" />
                    Add device
                </Button>
            </div>
        </div>
        <div class="devices-body assigned-devices-content">
            <div class="tag-devices-search">
                <InputField
                    type="text"
                    placeholder="Search by device name or MAC address"
                    value={deviceSearchTerm}
                    on:input={(e) => (deviceSearchTerm = e.detail)}
                    suffixIcon={true}
                />
            </div>
            <div class="assigned-devices-table-wrap">
                <table class="assigned-devices-table">
                    <thead>
                        <tr class="assigned-devices-thead-tr">
                            <th
                                class="assigned-devices-th assigned-devices-th-name cursor-pointer hover:bg-gray-100 select-none"
                                role="button"
                                tabindex="0"
                                on:click={() => handleDevicesSort('name')}
                                on:keydown={(e) => e.key === 'Enter' && handleDevicesSort('name')}
                            >
                                <span class="assigned-devices-th-inner">Device Name {#if devicesSort.field === 'name'}<span class="assigned-devices-th-icon">{#if devicesSort.direction === 'asc'}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}</span>{/if}</span>
                            </th>
                            <th
                                class="assigned-devices-th cursor-pointer hover:bg-gray-100 select-none"
                                role="button"
                                tabindex="0"
                                on:click={() => handleDevicesSort('macAddress')}
                                on:keydown={(e) => e.key === 'Enter' && handleDevicesSort('macAddress')}
                            >
                                <span class="assigned-devices-th-inner">MAC Address {#if devicesSort.field === 'macAddress'}<span class="assigned-devices-th-icon">{#if devicesSort.direction === 'asc'}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}</span>{/if}</span>
                            </th>
                            <th
                                class="assigned-devices-th cursor-pointer hover:bg-gray-100 select-none"
                                role="button"
                                tabindex="0"
                                on:click={() => handleDevicesSort('deviceType')}
                                on:keydown={(e) => e.key === 'Enter' && handleDevicesSort('deviceType')}
                            >
                                <span class="assigned-devices-th-inner">Operating System {#if devicesSort.field === 'deviceType'}<span class="assigned-devices-th-icon">{#if devicesSort.direction === 'asc'}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}</span>{/if}</span>
                            </th>
                            <th
                                class="assigned-devices-th cursor-pointer hover:bg-gray-100 select-none"
                                role="button"
                                tabindex="0"
                                on:click={() => handleDevicesSort('status')}
                                on:keydown={(e) => e.key === 'Enter' && handleDevicesSort('status')}
                            >
                                <span class="assigned-devices-th-inner">Status {#if devicesSort.field === 'status'}<span class="assigned-devices-th-icon">{#if devicesSort.direction === 'asc'}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}</span>{/if}</span>
                            </th>
                            <th
                                class="assigned-devices-th cursor-pointer hover:bg-gray-100 select-none"
                                role="button"
                                tabindex="0"
                                on:click={() => handleDevicesSort('lastUsedAt')}
                                on:keydown={(e) => e.key === 'Enter' && handleDevicesSort('lastUsedAt')}
                            >
                                <span class="assigned-devices-th-inner">Last Seen {#if devicesSort.field === 'lastUsedAt'}<span class="assigned-devices-th-icon">{#if devicesSort.direction === 'asc'}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}</span>{/if}</span>
                            </th>
                            <th class="assigned-devices-th assigned-devices-th-actions">
                                <span class="assigned-devices-th-inner">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {#if paginatedDeviceRows.length === 0}
                            <tr>
                                <td colspan="6" class="assigned-devices-empty">No devices assigned to this tag</td>
                            </tr>
                        {:else}
                            {#each paginatedDeviceRows as row}
                                <tr class="assigned-devices-tbody-tr">
                                    <td class="assigned-devices-td assigned-devices-td-name">
                                        <div class="assigned-devices-name-cell">
                                            <span class="assigned-devices-name-text">{row.name}</span>
                                            {#if row.deviceType && row.deviceType !== '—'}
                                                <div class="assigned-devices-tags">
                                                    <span class="assigned-devices-tag">{row.deviceType}</span>
                                                </div>
                                            {/if}
                                        </div>
                                    </td>
                                    <td class="assigned-devices-td">{row.macAddress}</td>
                                    <td class="assigned-devices-td">{row.deviceType}</td>
                                    <td class="assigned-devices-td assigned-devices-td-status">
                                        <Badge
                                            label={row.status === 'ACTIVE' ? 'Online' : 'Offline'}
                                            color={row.status === 'ACTIVE' ? 'success' : 'gray'}
                                            variant="filled"
                                            size="md"
                                            showDot={false}
                                        />
                                    </td>
                                    <td class="assigned-devices-td">{formatLastSeen(row.lastUsedAt)}</td>
                                    <td class="assigned-devices-td assigned-devices-td-actions">
                                        <div on:click|stopPropagation>
                                            <ActionMenu
                                                open={openMoreMenuKey === row.id}
                                                items={getDeviceMenuActions(row)}
                                                triggerIcon="dots-vertical"
                                                align="right"
                                                size="sm"
                                                triggerVariant="text"
                                                width="auto"
                                                on:open={() => { openMoreMenuKey = row.id; }}
                                                on:close={() => { openMoreMenuKey = null; }}
                                                on:select={(e) => handleDeviceActionSelect(row, e.detail.id)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        {/if}
                    </tbody>
                </table>
            </div>
            {#if devicesTotalItems > 0}
                <div class="assigned-devices-pagination">
                    <span class="assigned-devices-pagination-details">
                        {devicesRangeStart} - {devicesRangeEnd} of {devicesTotalItems}
                    </span>
                    <div class="assigned-devices-pagination-buttons">
                        <button type="button" class="assigned-devices-pagination-btn" on:click={devicesFirstPage} disabled={devicesPage <= 1} aria-label="First page">
                            <ChevronsLeft size={20} />
                        </button>
                        <button type="button" class="assigned-devices-pagination-btn" on:click={devicesPrevPage} disabled={devicesPage <= 1} aria-label="Previous page">
                            <ChevronLeft size={20} />
                        </button>
                        <span class="assigned-devices-pagination-page">{devicesPage}</span>
                        <button type="button" class="assigned-devices-pagination-btn" on:click={devicesNextPage} disabled={devicesPage >= devicesTotalPages} aria-label="Next page">
                            <ChevronRight size={20} />
                        </button>
                        <button type="button" class="assigned-devices-pagination-btn" on:click={devicesLastPage} disabled={devicesPage >= devicesTotalPages} aria-label="Last page">
                            <ChevronsRight size={20} />
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </Card>
    </div>

<ConfirmModal
    open={confirmRemoveDeviceOpen}
    title="Remove Device"
    description="Are you sure you want to remove this device? This action can not be reverse."
    confirmText="Remove"
    cancelText="Cancel"
    type="error"
    confirmLoading={removeDeviceLoading}
    on:confirm={handleConfirmRemoveDevice}
    on:close={() => { if (!removeDeviceLoading) { confirmRemoveDeviceOpen = false; deviceToRemove = null; } }}
/>

<AddDeviceToTagModal
    open={showAddDeviceModal}
    tagId={deviceTag?.id ?? ''}
    excludeDeviceIds={excludeDeviceIds}
    on:close={closeAddDeviceModal}
    on:added={onAddDeviceAdded}
/>

<ConfirmModal
    open={showDeleteModal}
    title={deviceTag?.devices?.length
        ? `Delete Tag — Unassign from ${deviceTag.devices.length} Device(s)`
        : "Delete Tag"}
    description={deviceTag?.devices?.length
        ? `This tag is assigned to ${deviceTag.devices.length} device(s). Removing it will unassign it from all devices. This action cannot be reversed.`
        : "Are you sure you want to delete this tag? Once you delete this tag, it can not be reversed."}
    confirmText="Delete"
    cancelText="Cancel"
    type={deviceTag?.devices?.length ? 'warning' : 'error'}
    confirmLoading={deleteTagLoading}
    on:close={closeDeleteModal}
    on:confirm={handleDeleteConfirm}
/>

<EditTagModal
    bind:open={showEditTagModal}
    tag={editTagData}
    {accounts}
    loading={editTagLoading}
    serverError={editTagError}
    on:close={closeEditTagModal}
    on:save={handleEditTag}
    on:clearError={() => (editTagError = '')}
/>

<style>
    .tag-detail {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 24px;
        gap: 16px;
        width: 100%;
    }
    .detail-buttons {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        width: 100%;
    }
    .detail-buttons-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 12px;
    }
    .detail-grid {
        display: flex;
        flex-direction: row;
        align-items: stretch;
        gap: 16px;
        width: 100%;
        min-width: 0;
    }
    .detail-grid > :global(.ds-card) {
        flex: 1;
        min-width: 0;
    }
    .overview-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 8px;
        border-bottom: 1px solid #E5E5E5;
        width: 100%;
        min-width: 0;
    }
    .overview-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
    }
    .devices-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: 8px;
        border-bottom: 0;
        width: 100%;
    }
    .devices-header-actions {
        flex-shrink: 0;
    }
    .overview-header-icon,
    .devices-header-icon {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color: #A3A3A3;
        flex-shrink: 0;
    }
    .overview-header-icon:hover,
    .devices-header-icon:hover {
        background: var(--ds-color-neutral-true-100);
    }
    .overview-header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .devices-header .devices-header-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .overview-title {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }
    .overview-subtitle {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }
    .overview-body {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 16px;
        gap: 16px;
        width: 100%;
        min-width: 0;
        overflow: hidden;
    }
    .overview-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        width: 100%;
        min-width: 0;
    }
    .overview-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        overflow: hidden;
    }
    .overview-field-desc {
        grid-column: 2 / -1;
    }
    @media (max-width: 900px) {
        .overview-grid {
            grid-template-columns: repeat(2, 1fr);
        }
        .overview-field-desc {
            grid-column: 1 / -1;
        }
    }
    @media (max-width: 600px) {
        .overview-grid {
            grid-template-columns: 1fr;
        }
        .overview-field-desc {
            grid-column: 1;
        }
    }
    .overview-label {
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: #525252;
    }
    .overview-value {
        font-family: var(--ds-font-family-primary);
        font-size: 16px;
        font-weight: 500;
        line-height: 24px;
        color: #141414;
    }
    /* TC-IOT-TG-0020: Truncate long tag name to prevent layout overflow */
    .overview-value-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
    }
    /* TC-IOT-TG-0021: Limit description to 3 lines with ellipsis to prevent layout overflow */
    .overview-value-desc {
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        word-break: break-word;
    }
    .devices-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 0;
        width: 100%;
        min-width: 0;
    }
    .tag-devices-search {
        padding: 12px 16px;
        border-bottom: 1px solid var(--ds-color-gray-200, #EAECF0);
    }
    .tag-devices-search :global(.ds-input-field) {
        max-width: 320px;
    }
    .assigned-devices-content {
        display: flex;
        flex-direction: column;
        padding: 0;
        width: 100%;
        overflow: hidden;
    }
    .assigned-devices-table-wrap {
        width: 100%;
        overflow-x: auto;
    }
    .assigned-devices-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }
    .assigned-devices-thead-tr {
        display: table-row;
    }
    .assigned-devices-th {
        box-sizing: border-box;
        display: table-cell;
        padding: 12px 16px;
        background: var(--ds-color-neutral-true-100, #F5F5F5);
        border-bottom: 1px solid var(--ds-color-gray-200, #EAECF0);
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-600, #475467);
        text-align: left;
        height: 44px;
        vertical-align: middle;
    }
    .assigned-devices-th-inner {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 4px;
    }
    .assigned-devices-th-icon {
        display: inline-flex;
        flex-shrink: 0;
        color: var(--ds-color-gray-600, #475467);
    }
    .assigned-devices-th-name {
        min-width: 200px;
        width: 42%;
    }
    .assigned-devices-th:not(.assigned-devices-th-name) {
        width: 14%;
    }
    .assigned-devices-tbody-tr {
        display: table-row;
        background: var(--ds-color-white, #FFFFFF);
    }
    .assigned-devices-td {
        box-sizing: border-box;
        display: table-cell;
        padding: 16px;
        border-bottom: 1px solid var(--ds-color-gray-200, #EAECF0);
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-900, #141414);
        vertical-align: middle;
        min-height: 52px;
    }
    .assigned-devices-td-name {
        padding: 12px 16px;
        vertical-align: top;
    }
    .assigned-devices-td-status {
        padding: 12px 16px;
    }
    .assigned-devices-name-cell {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        gap: 6px;
    }
    .assigned-devices-name-text {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-900, #141414);
    }
    .assigned-devices-tags {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 4px;
        flex-wrap: wrap;
    }
    .assigned-devices-tag {
        box-sizing: border-box;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        padding: 4px;
        background: var(--ds-color-white, #FFFFFF);
        border: 1px solid var(--ds-color-neutral-true-300, #D6D6D6);
        border-radius: 6px;
        font-weight: 500;
        font-size: 12px;
        line-height: 16px;
        color: var(--ds-color-neutral-true-700, #424242);
    }
    .assigned-devices-td-status :global(button.badge) {
        padding: 4px 8px;
        border-radius: 16px;
    }
    .assigned-devices-empty {
        padding: 24px 16px;
        text-align: center;
        color: var(--ds-text-secondary);
        font-size: 14px;
    }
    .assigned-devices-pagination {
        display: flex;
        flex-direction: row;
        justify-content: flex-end;
        align-items: center;
        padding: 8px 24px;
        gap: 8px;
        width: 100%;
        min-height: 56px;
        border-top: 1px solid var(--ds-color-gray-200, #EAECF0);
    }
    .assigned-devices-pagination-details {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-neutral-true-600, #525252);
    }
    .assigned-devices-pagination-buttons {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 2px;
    }
    .assigned-devices-pagination-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 36px;
        height: 36px;
        padding: 8px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--ds-color-neutral-true-800, #292929);
        cursor: pointer;
    }
    .assigned-devices-pagination-btn:hover:not(:disabled) {
        background: var(--ds-color-gray-50, #F9FAFB);
    }
    .assigned-devices-pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .assigned-devices-pagination-page {
        display: flex;
        justify-content: center;
        align-items: center;
        min-width: 40px;
        height: 36px;
        padding: 0 12px;
        background: var(--ds-color-gray-50, #F9FAFB);
        border-radius: 8px;
        font-family: var(--ds-font-family-secondary, 'Inter');
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
        color: var(--ds-color-gray-800, #1D2939);
    }
    .assigned-devices-th-actions {
        width: 85px;
    }
    .assigned-devices-td-actions {
        padding: 12px 16px;
        vertical-align: middle;
    }
</style>
