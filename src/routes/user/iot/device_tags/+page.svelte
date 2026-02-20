<script lang="ts">
    import DeviceTagTable from "./table.svelte";
    import { Button, InputField, ConfirmModal } from "$lib/design-system/components";
    import { Plus, Search } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto, invalidate } from "$app/navigation";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
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
    onMount(() => {
        searchValue = $page.url.searchParams.get('search') || '';
    });
    $: urlSearch = $page.url.searchParams.get('search') || '';
    $: if (urlSearch !== searchValue && searchValue === '') searchValue = urlSearch;

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
    }

    async function handleAddTag(event: CustomEvent<{ name: string; description: string; accountId: string }>) {
        const { name, description } = event.detail;
        addTagLoading = true;

        try {
            const fd = new FormData();
            fd.set('name', name);
            fd.set('description', description);

            const res = await fetch('/user/iot/device_tags', { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (!res.ok || result?.success === false) {
                toast.error(result?.error || 'Unable to add Tag. Please try again!');
                return;
            }

            toast.success('Tag added successfully!');
            closeAddTagModal();
            await invalidate('app:userDeviceTags');
        } catch {
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
    }

    function handleTableEdit(event: CustomEvent<DeviceTagRow>) {
        openEditTag(event.detail);
    }

    async function handleEditTag(event: CustomEvent<{ id: string; name: string; description: string; accountId: string }>) {
        const { id, name, description } = event.detail;
        editTagLoading = true;

        try {
            const fd = new FormData();
            fd.set('name', name);
            fd.set('description', description);

            const res = await fetch(`/user/iot/device_tags/${id}?/updateTag`, { method: 'POST', body: fd });
            const result = await res.json().catch(() => ({}));

            if (result?.type === 'failure') {
                toast.error(result?.data?.error || 'Unable to update Tag. Please try again!');
                return;
            }

            if (result?.type === 'success' || result?.data?.success) {
                toast.success('Tag updated successfully!');
                closeEditTagModal();
                await invalidate('app:userDeviceTags');
            } else {
                toast.error('Unable to update Tag. Please try again!');
            }
        } catch {
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
                type="search"
                placeholder="Search by name"
                bind:value={searchValue}
                prefixIcon={true}
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
    on:close={closeAddTagModal}
    on:add={handleAddTag}
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
    on:close={closeEditTagModal}
    on:save={handleEditTag}
/>

<ConfirmModal
    open={showDeleteModal}
    title="Delete Tag"
    description="Are you sure you want to delete this tag? Once you delete this tag, it can not be reversed."
    confirmText="Delete"
    cancelText="Cancel"
    type="error"
    confirmLoading={deleteTagLoading}
    on:close={closeDeleteModal}
    on:confirm={handleDeleteConfirm}
/>
