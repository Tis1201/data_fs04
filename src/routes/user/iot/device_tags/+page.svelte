<script lang="ts">
    import DeviceTagTable from "./table.svelte";
    import { Button, InputField } from "$lib/design-system/components";
    import { Plus, Search } from "lucide-svelte";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    export let data: PageData;

    $: ({ deviceTags: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = meta?.sort || { field: "createdAt", order: "desc" };

    let loading = false;
    let searchValue = '';

    initPagination('preferredPageSize', true);
    onMount(() => {
        searchValue = $page.url.searchParams.get('search') || '';
    });
    $: urlSearch = $page.url.searchParams.get('search') || '';
    $: if (urlSearch !== searchValue && searchValue === '') searchValue = urlSearch;

    // Debounced search reload (match devices page behavior)
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
        goto('/user/iot/device_tags/new');
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
    />
</div>
