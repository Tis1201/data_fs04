<script lang="ts">
    import DeviceTagTable from "./table.svelte";
    import { Button, InputField, ConfirmModal } from "$lib/design-system/components";
    import { Plus, Search } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto, invalidate } from "$app/navigation";
    import { deserialize } from '$app/forms';
    import { page } from "$app/stores";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import AddTagModal from "$lib/components/ui_components_sveltekit/device_tags/AddTagModal.svelte";
    import EditTagModal from "$lib/components/ui_components_sveltekit/device_tags/EditTagModal.svelte";
    import { toast } from '$lib/stores/alertToast';
    import type { DeviceTag } from '@prisma/client';

    type DeviceTagRow = DeviceTag & { _count?: { devices: number } };

    export let data: PageData;

    $: ({ deviceTags: records, meta, currentAccount } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = meta?.sort || { field: "createdAt", order: "desc" };

    let loading = false;
    let searchValue = '';
    let _lastSyncedUrl = '';

    /** Sync search input from URL when URL changes (load, back/forward, or after our goto). */
    $: currentUrl = $page.url.pathname + $page.url.search;
    $: if (currentUrl !== _lastSyncedUrl) {
        _lastSyncedUrl = currentUrl;
        searchValue = $page.url.searchParams.get('search') || '';
    }

    let showAddTagModal = false;
    let addTagLoading = false;

    let showEditTagModal = false;
    let editTagLoading = false;
    let editTagData: DeviceTagRow | null = null;

    let showDeleteModal = false;
    let deleteTagLoading = false;
    let deleteTagData: DeviceTagRow | null = null;

    $: accounts = currentAccount ? [currentAccount] : [];

    initPagination('preferredPageSize', true);

    let searchTimeout: ReturnType<typeof setTimeout>;
    let searchDebounceHasRunOnce = false;
    $: {
        if (searchValue !== undefined && typeof window !== 'undefined') {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (!searchDebounceHasRunOnce) {
                    searchDebounceHasRunOnce = true;
                    return;
                }
                const urlSearch = $page.url.searchParams.get('search') || '';
                if (searchValue === urlSearch) return;
                const url = new URL($page.url.href);
                if (searchValue) url.searchParams.set('search', searchValue);
                else url.searchParams.delete('search');
                url.searchParams.set('page', '1');
                goto(url.pathname + url.search, { noScroll: true, keepFocus: true });
            }, 500);
        }
    }

    function openAddTag() {
        showAddTagModal = true;
    }

    function closeAddTagModal() {
        showAddTagModal = false;
        addTagError = '';
    }

    let addTagError = '';

    async function handleAddTag(event: CustomEvent<{ name: string; description: string; accountId: string }>) {
        const { name, description } = event.detail;
        addTagError = '';
        addTagLoading = true;

        try {
            const fd = new FormData();
            fd.set('name', name);
            fd.set('description', description);

            const res = await fetch('/user/iot/device_tags', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (!res.ok || result?.success === false) {
                const err = result?.error || 'Unable to add Tag. Please try again!';
                addTagError = err;
                toast.error(err);
                return;
            }

            toast.success('Tag added successfully!');
            closeAddTagModal();
            await invalidate('app:userDeviceTags');
        } catch {
            addTagError = 'Unable to add Tag. Please try again!';
            toast.error('Unable to add Tag. Please try again!');
        } finally {
            addTagLoading = false;
        }
    }

    function openEditTag(tag: DeviceTagRow) {
        editTagData = tag;
        showEditTagModal = true;
    }

    function closeEditTagModal() {
        showEditTagModal = false;
        editTagData = null;
        editTagError = '';
    }

    function handleTableEdit(event: CustomEvent<DeviceTagRow>) {
        openEditTag(event.detail);
    }

    let editTagError = '';

    /** Extract error message from action failure. Handles superforms devalue structure. */
    function getFormActionError(result: { data?: unknown }, fallback: string): string {
        const d = result.data;
        if (d && typeof d === 'object') {
            const o = d as Record<string, unknown>;
            const form = o.form as Record<string, unknown> | undefined;
            const msg = form?.message as Record<string, unknown> | undefined;
            const errMsg = msg?.error as { message?: string } | undefined;
            if (typeof errMsg?.message === 'string') return errMsg.message;
            const topMsg = o.message as { error?: { message?: string } } | undefined;
            if (typeof topMsg?.error?.message === 'string') return topMsg.error.message;
            if (typeof o.error === 'string') return o.error;
            const err = o.error as { message?: string } | undefined;
            if (err && typeof err.message === 'string') return err.message;
            if (typeof o.message === 'string') return o.message;
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

    function extractErrorFromDevalueString(text: string): string | null {
        const known = ['Device tag with this name already exists', 'Device tag not found', 'You do not have permission', 'No current account selected'];
        for (const msg of known) {
            if (text.includes(msg)) return msg;
        }
        return null;
    }

    async function handleEditTag(event: CustomEvent<{ id: string; name: string; description: string; accountId: string }>) {
        const { id, name, description } = event.detail;
        editTagError = '';
        editTagLoading = true;

        try {
            const fd = new FormData();
            fd.set('name', name);
            fd.set('description', description);

            const res = await fetch(`/user/iot/device_tags/${id}?/updateTag`, { method: 'POST', body: fd });
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
                await invalidate('app:userDeviceTags');
            } else {
                editTagError = 'Unable to update Tag. Please try again!';
                toast.error('Unable to update Tag. Please try again!');
            }
        } catch {
            editTagError = 'Unable to update Tag. Please try again!';
            toast.error('Unable to update Tag. Please try again!');
        } finally {
            editTagLoading = false;
        }
    }

    function handleTableDelete(event: CustomEvent<DeviceTagRow>) {
        deleteTagData = event.detail;
        showDeleteModal = true;
    }

    function closeDeleteModal() {
        showDeleteModal = false;
        deleteTagData = null;
    }

    async function handleDeleteConfirm() {
        if (!deleteTagData) return;
        
        deleteTagLoading = true;

        try {
            const res = await fetch('/user/iot/device_tags', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: deleteTagData.id })
            });
            const result = await res.json().catch(() => ({}));

            if (!res.ok || result?.success === false) {
                toast.error(result?.error || 'Unable to delete Tag. Please try again!');
                return;
            }

            toast.success('Tag deleted successfully!');
            closeDeleteModal();
            await invalidate('app:userDeviceTags');
        } catch {
            toast.error('Unable to delete Tag. Please try again!');
        } finally {
            deleteTagLoading = false;
        }
    }
</script>

<!-- Match Devices page layout: padding 24px, gap 16px -->
<div class="flex flex-col items-start" style="padding: 24px; gap: 16px;">
    <!-- Search & Add row: same as Devices (gap 16px, height 48px) -->
    <div class="flex flex-row items-center" style="gap: 16px; height: 48px; width: 100%;">
        <div style="width: 500px; height: 48px;">
            <InputField
                type="text"
                placeholder="Search by name"
                bind:value={searchValue}
                prefixIcon={true}
                autocomplete="off"
            >
                <Search size={22} slot="prefix-icon" />
            </InputField>
        </div>
        <div style="flex: 1;"></div>
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={openAddTag}
            style="width: 156px; height: 44px; background: var(--ds-color-blue-light-600); border: 1px solid var(--ds-color-blue-light-600); box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
        >
            <Plus size={20} slot="icon-left" />
            Add Tag
        </Button>
    </div>

    <DeviceTagTable
        props={{
            records,
            pagination,
            sort,
            loading
        }}
        on:edit={handleTableEdit}
        on:delete={handleTableDelete}
    />
</div>

<AddTagModal
    bind:open={showAddTagModal}
    {accounts}
    currentAccountId={currentAccount?.id || ''}
    loading={addTagLoading}
    serverError={addTagError}
    on:close={closeAddTagModal}
    on:add={handleAddTag}
    on:clearError={() => (addTagError = '')}
/>

<EditTagModal
    bind:open={showEditTagModal}
    tag={editTagData ? { 
        id: editTagData.id, 
        name: editTagData.name, 
        description: editTagData.description,
        accountId: currentAccount?.id 
    } : null}
    {accounts}
    loading={editTagLoading}
    serverError={editTagError}
    on:close={closeEditTagModal}
    on:save={handleEditTag}
    on:clearError={() => (editTagError = '')}
/>

<ConfirmModal
    open={showDeleteModal}
    title={deleteTagData?._count?.devices 
        ? `Delete Tag — Unassign from ${deleteTagData._count.devices} Device(s)` 
        : "Delete Tag"}
    description={deleteTagData?._count?.devices 
        ? `This tag is assigned to ${deleteTagData._count.devices} device(s). Removing it will unassign it from all devices. This action cannot be reversed.` 
        : "Are you sure you want to delete this tag? Once you delete this tag, it can not be reversed."}
    confirmText="Delete"
    cancelText="Cancel"
    type={deleteTagData?._count?.devices ? 'warning' : 'error'}
    confirmLoading={deleteTagLoading}
    on:close={closeDeleteModal}
    on:confirm={handleDeleteConfirm}
/>
