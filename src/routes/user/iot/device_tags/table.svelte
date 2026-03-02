<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { createEventDispatcher } from 'svelte';
    import LoadingSkeleton from "$lib/components/ui_components_sveltekit/table/LoadingSkeleton.svelte";
    import { ArrowUp, ArrowDown, MoreVertical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-svelte";
    import type { DeviceTag } from "@prisma/client";
    import { handleTableSort, handleTablePagination } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";

    type DeviceTagRow = DeviceTag & { _count?: { devices: number } };

    const dispatch = createEventDispatcher<{
        edit: DeviceTagRow;
        delete: DeviceTagRow;
    }>();

    export let props = {
        records: [] as DeviceTagRow[],
        pagination: {
            page: 1,
            per_page: 10,
            total_records: 0,
            total_pages: 0
        },
        sort: {
            field: "createdAt",
            order: "desc" as "asc" | "desc"
        },
        loading: false
    };

    let openActionMenuId: string | null = null;
    let actionMenuPosition: { top: number; left: number } | null = null;

    function toggleActionMenu(rowId: string, e: MouseEvent) {
        if (openActionMenuId === rowId) {
            openActionMenuId = null;
            actionMenuPosition = null;
            return;
        }
        const button = e.currentTarget as HTMLElement;
        const rect = button.getBoundingClientRect();
        const menuHeight = 160;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
        const spaceBelow = viewportHeight - rect.bottom;
        if (spaceBelow < menuHeight) {
            actionMenuPosition = { top: rect.top - menuHeight - 4, left: rect.right - 192 };
        } else {
            actionMenuPosition = { top: rect.bottom + 4, left: rect.right - 192 };
        }
        openActionMenuId = rowId;
    }

    function handleClickOutside() {
        openActionMenuId = null;
        actionMenuPosition = null;
    }

    function handleSort(columnId: string) {
        const currentField = props.sort?.field || '';
        const currentOrder = props.sort?.order || 'asc';
        let nextField = columnId;
        let nextOrder: 'asc' | 'desc' = 'asc';
        if (currentField === columnId) {
            if (currentOrder === 'asc') nextOrder = 'desc';
            else { nextField = ''; nextOrder = 'asc'; }
        }
        handleTableSort(new CustomEvent('sort', { detail: { field: nextField || null, order: nextOrder } }) as any);
    }

    function goToPage(pageNum: number) {
        handleTablePagination(new CustomEvent('pagination', {
            detail: { page: pageNum, per_page: props.pagination.per_page }
        }) as any);
    }

    function getPageNumbers(): (number | string)[] {
        const p = props.pagination.page;
        const totalPages = Math.max(1, props.pagination.total_pages);
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const pages: (number | string)[] = [1];
        if (p > 3) pages.push('...');
        const start = Math.max(2, p - 1);
        const end = Math.min(totalPages - 1, p + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (p < totalPages - 2) pages.push('...');
        if (totalPages > 1) pages.push(totalPages);
        return pages;
    }

    // Pagination display (match DeviceTable: total = total_records, perPage = per_page)
    $: paginationTotal = props.pagination.total_records;
    $: paginationPerPage = props.pagination.per_page;
    $: paginationPage = props.pagination.page;
    $: paginationTotalPages = Math.max(1, props.pagination.total_pages);
</script>

<svelte:window on:click={handleClickOutside} />

{#if props.loading}
    <div class="bg-white overflow-hidden" style="border-radius: 9px; border: 1px solid #E5E5E5;">
        <LoadingSkeleton />
    </div>
{:else}
    <!-- Match DeviceTable: border-radius 9px, border #E5E5E5 -->
    <div class="bg-white overflow-hidden" style="position: relative; border-radius: 9px; border: 1px solid #E5E5E5; width: 100%;">
        <div class="overflow-x-auto" style="position: relative;">
            <table class="w-full">
                <thead style="background: #F5F5F5; border-bottom: 1px solid #EAECF0;">
                    <tr>
                        <th
                            class="h-[44px] text-left cursor-pointer hover:bg-gray-100 select-none"
                            style="width: 20%; padding: 12px 16px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-600);"
                            role="button"
                            tabindex="0"
                            on:click={() => handleSort('name')}
                            on:keydown={(e) => e.key === 'Enter' && handleSort('name')}
                        >
                            <div class="flex items-center" style="gap: 4px;">
                                <span>Name</span>
                                {#if props.sort?.field === 'name'}
                                    <span class="flex items-center justify-center" style="width: 16px; height: 16px;">
                                        {#if props.sort.order === 'desc'}
                                            <ArrowDown size={16} strokeWidth={1.33} style="color: #475467;" />
                                        {:else}
                                            <ArrowUp size={16} strokeWidth={1.33} style="color: #475467;" />
                                        {/if}
                                    </span>
                                {/if}
                            </div>
                        </th>
                        <th
                            class="h-[44px] text-left cursor-pointer hover:bg-gray-100 select-none"
                            style="width: 40%; padding: 12px 16px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); color: var(--ds-color-gray-600);"
                            role="button"
                            tabindex="0"
                            on:click={() => handleSort('description')}
                            on:keydown={(e) => e.key === 'Enter' && handleSort('description')}
                        >
                            <div class="flex items-center" style="gap: 4px;">
                                <span>Description</span>
                                {#if props.sort?.field === 'description'}
                                    <span class="flex items-center justify-center" style="width: 16px; height: 16px;">
                                        {#if props.sort.order === 'desc'}
                                            <ArrowDown size={16} strokeWidth={1.33} style="color: #475467;" />
                                        {:else}
                                            <ArrowUp size={16} strokeWidth={1.33} style="color: #475467;" />
                                        {/if}
                                    </span>
                                {/if}
                            </div>
                        </th>
                        <th class="h-[44px] text-left" style="width: 15%; padding: 12px 16px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); color: var(--ds-color-gray-600);">
                            Assigned Devices
                        </th>
                        <th class="h-[44px] text-left" style="width: 10%; padding: 12px 16px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); color: var(--ds-color-gray-600);">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {#if !props.records || props.records.length === 0}
                        <tr>
                            <td colspan={4} class="px-4 py-12 text-center" style="font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); color: var(--ds-color-gray-500);">
                                No tags found
                            </td>
                        </tr>
                    {:else}
                        {#each props.records as row (row.id)}
                            <tr class="hover:bg-gray-50 transition-colors" style="height: 72px; border-bottom: 1px solid #EAECF0; background: #FFFFFF;">
                                <td class="h-[72px] td-name" style="padding: 12px 16px; border-bottom: 1px solid #EAECF0;">
                                    <a
                                        href="/user/iot/device_tags/{row.id}"
                                        class="block text-left font-medium tag-name-cell"
                                        style="font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-primary-700); text-decoration: none;"
                                        title={row.name}
                                    >
                                        {row.name}
                                    </a>
                                    {#if row.id}
                                        <div class="tag-id-cell" title={row.id} style="font-family: var(--ds-font-family-primary); font-size: 12px; color: var(--ds-color-gray-500); margin-top: 2px;">{row.id}</div>
                                    {/if}
                                </td>
                                <td class="h-[72px] td-desc" style="padding: 16px; border-bottom: 1px solid #EAECF0;">
                                    <span class="tag-desc-cell" style="font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-900);" title={row.description || undefined}>{row.description || "—"}</span>
                                </td>
                                <td class="h-[72px]" style="padding: 16px; border-bottom: 1px solid #EAECF0;">
                                    <span style="font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); color: var(--ds-color-gray-900);">{row._count?.devices ?? 0}</span>
                                </td>
                                <td class="h-[72px]" style="padding: 8px 16px; border-bottom: 1px solid #EAECF0;">
                                    <div class="relative">
                                        <button
                                            type="button"
                                            class="flex items-center justify-center rounded-lg transition-colors hover:bg-[#F9FAFB]"
                                            style="width: 40px; height: 40px;"
                                            on:click|stopPropagation={(e) => toggleActionMenu(row.id, e)}
                                        >
                                            <MoreVertical size={20} style="color: #475467;" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>

        <!-- Pagination: same as DeviceTable - 56px height, border-top #EAECF0 -->
        {#if paginationTotal > 0}
            <div class="flex items-center justify-end bg-white" style="padding: 8px 24px; height: 56px; border-top: 1px solid #EAECF0; gap: 8px;">
                <div style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-600); white-space: nowrap;">
                    {(paginationPage - 1) * paginationPerPage + 1} - {Math.min(paginationPage * paginationPerPage, paginationTotal)} of {paginationTotal}
                </div>
                <div class="flex items-center" style="gap: 2px;">
                    <button
                        type="button"
                        class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                        disabled={paginationPage === 1}
                        on:click={() => goToPage(1)}
                    >
                        <ChevronsLeft size={20} style="color: #292929;" />
                    </button>
                    <button
                        type="button"
                        class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                        disabled={paginationPage === 1}
                        on:click={() => goToPage(paginationPage - 1)}
                    >
                        <ChevronLeft size={20} style="color: #292929;" />
                    </button>
                    {#each getPageNumbers() as pageNum}
                        {#if pageNum === "..."}
                            <span style="padding: 0 8px; color: #A3A3A3;">...</span>
                        {:else}
                            <button
                                type="button"
                                class="flex items-center justify-center rounded transition-colors"
                                style="width: 40px; height: 40px; padding: 12px; border-radius: var(--ds-radius-lg); font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); {paginationPage === pageNum ? 'background: var(--ds-color-gray-50); color: var(--ds-color-gray-800);' : 'color: var(--ds-color-gray-600);'}"
                                on:click={() => goToPage(Number(pageNum))}
                            >
                                {pageNum}
                            </button>
                        {/if}
                    {/each}
                    <button
                        type="button"
                        class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                        disabled={paginationPage === paginationTotalPages}
                        on:click={() => goToPage(paginationPage + 1)}
                    >
                        <ChevronRight size={20} style="color: #292929;" />
                    </button>
                    <button
                        type="button"
                        class="flex items-center justify-center rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        style="width: 36px; height: 36px; padding: 8px; border-radius: 8px;"
                        disabled={paginationPage === paginationTotalPages}
                        on:click={() => goToPage(paginationTotalPages)}
                    >
                        <ChevronsRight size={20} style="color: #292929;" />
                    </button>
                </div>
            </div>
        {/if}
    </div>
{/if}

<!-- Action menu portal (same style as DeviceTable) -->
{#if openActionMenuId && actionMenuPosition}
    {@const currentRow = props.records.find((r) => r.id === openActionMenuId)}
    {#if currentRow}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="fixed inset-0"
            style="z-index: 9998;"
            on:click={() => { openActionMenuId = null; actionMenuPosition = null; }}
            on:keydown={(e) => { if (e.key === 'Escape') { openActionMenuId = null; actionMenuPosition = null; } }}
        ></div>
        <div
            class="fixed bg-white rounded-lg shadow-lg py-2"
            style="top: {actionMenuPosition.top}px; left: {actionMenuPosition.left}px; z-index: 9999; min-width: 160px; border: 1px solid #E5E5E5; border-radius: 12px;"
            role="menu"
            tabindex="-1"
        >
            <a
                href="/user/iot/device_tags/{currentRow.id}"
                class="block w-full text-left hover:bg-[#F9FAFB] transition-colors"
                style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800); border: none; background: transparent; cursor: pointer; text-decoration: none;"
            >
                View
            </a>
            <button
                type="button"
                class="block w-full text-left hover:bg-[#F9FAFB] transition-colors"
                style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800); border: none; background: transparent; cursor: pointer;"
                on:click={() => { dispatch('edit', currentRow); openActionMenuId = null; actionMenuPosition = null; }}
            >
                Edit
            </button>
            <div style="height: 1px; background: var(--ds-border-default); margin: 4px 0;"></div>
            <button
                type="button"
                class="w-full text-left hover:bg-[#F9FAFB] transition-colors"
                style="padding: 10px 16px; font-family: var(--ds-font-family-primary); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-error-600); border: none; background: transparent; cursor: pointer;"
                on:click={() => { dispatch('delete', currentRow); openActionMenuId = null; actionMenuPosition = null; }}
            >
                Delete
            </button>
        </div>
    {/if}
{/if}

<style>
    table {
        font-family: var(--ds-font-family-primary);
    }
    th, td {
        vertical-align: middle;
    }
    a[href].block:hover {
        text-decoration: underline;
        color: var(--ds-color-primary-800);
    }
    .td-name, .td-desc {
        max-width: 0;
    }
    .tag-name-cell {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }
    .tag-id-cell {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }
    .tag-desc-cell {
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        word-break: break-word;
    }
</style>
