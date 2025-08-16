<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import DebouncedTextFilter from "$lib/components/ui_components_sveltekit/table/filter/DebouncedTextFilter.svelte";
    import PopoverFilter from "$lib/components/ui_components_sveltekit/table/filter/PopoverFilter.svelte";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import Badge from "$lib/components/ui/badge/badge.svelte";
    import { Checkbox } from '$lib/components/ui/checkbox';
    import type { Resource } from "@prisma/client";
    import { writable } from "svelte/store";
    import Pagination from "$lib/components/ui_components_sveltekit/table/pagination/Pagination.svelte";

    // Filters
    const selectedFormats = writable<string[]>([]);
    const formatOptions = [
        { label: 'APK', value: 'apk' },
        { label: 'BIN', value: 'bin' },
        { label: 'HEX', value: 'hex' },
        { label: 'FIRMWARE', value: 'firmware' },
        { label: 'FW', value: 'fw' },
        { label: 'CPK', value: 'cpk' },
        { label: 'ZIP', value: 'zip' }
    ];

    // Props
    interface TableProps {
        records: Resource[];
        pagination: { page: number; per_page: number; total_records: number; total_pages: number };
        sort: { field: string; order: 'asc' | 'desc' };
        loading: boolean;
        selectedResourceIds?: string[];
    }
    export let props: TableProps;

    const dispatch = createEventDispatcher<{
        rowClick: Resource;
        sort: { field: string; order: 'asc' | 'desc' };
        pagination: { page: number; per_page: number };
        filter: { search?: string; formats?: string[] };
    }>();

    // Internal filter state; emit to parent
    let localSearch = '';
    let localFormats: string[] = [];
    function emitFilter() {
        dispatch('filter', { search: localSearch, formats: localFormats });
    }

    function handleSearchChange(event: CustomEvent) {
        const detail: any = (event as any).detail;
        localSearch = typeof detail === 'string' ? detail : '';
        emitFilter();
    }

    function handleSortClick(field: string) {
        const order = props.sort.field === field && props.sort.order === 'asc' ? 'desc' : 'asc';
        dispatch('sort', { field, order });
    }

    function handlePaginationChange(event: CustomEvent) {
        dispatch('pagination', event.detail);
    }

    function getResourceTypeDisplay(type: string) {
        const typeMap: Record<string, string> = { file: 'File', image: 'Image', video: 'Video', document: 'Document', binary: 'Binary' };
        return typeMap[type] || type;
    }
    function getResourceTargetDisplay(target: string) {
        const targetMap: Record<string, string> = { user: 'User', device: 'Device', account: 'Account' };
        return targetMap[target] || target;
    }
    function getFormatBadgeVariant(format: string | null) {
        if (!format) return 'outline';
        const formatVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            apk: 'default', bin: 'secondary', exe: 'destructive', sh: 'secondary'
        };
        return formatVariants[format] || 'outline';
    }
</script>

<div class="w-full">
    <!-- Filters -->
    <div class="p-4 border-b flex flex-wrap gap-2">
        <div class="w-1/3 min-w-[240px]">
            <DebouncedTextFilter
                placeholder="Search by app name..."
                value={localSearch}
                emitOnly={true}
                delay={0}
                on:change={handleSearchChange}
            />
        </div>
        <PopoverFilter
            label="Format"
            options={formatOptions}
            selectedValues={$selectedFormats}
            onChange={(values) => {
                selectedFormats.set(values);
                localFormats = values;
                emitFilter();
            }}
        />
    </div>

    <!-- Table -->
    <table class="w-full">
        <thead>
            <tr class="border-b">
                <th class="w-10 p-3"></th>
                <th class="text-left p-3">
                    <button class="p-0 font-medium text-sm flex items-center" on:click={() => handleSortClick('name')}>
                        Name
                    </button>
                </th>
                <th class="text-left p-3">Type</th>
                <th class="text-left p-3">Target</th>
                <th class="text-left p-3">Version</th>
                <th class="text-left p-3">Format</th>
                <th class="text-left p-3">Created</th>
            </tr>
        </thead>
        <tbody>
            {#if props.records.length === 0}
                <tr>
                    <td colspan="7" class="text-center p-4 text-muted-foreground">No apps found</td>
                </tr>
            {:else}
                {#each props.records as resource}
                    <tr class="border-b hover:bg-muted/50 cursor-pointer" on:click={() => dispatch('rowClick', resource)}>
                        <td class="p-3">
                            <button type="button" class="inline-flex" on:click|stopPropagation={() => dispatch('rowClick', resource)} aria-label={`Select ${resource.name}`}>
                                <Checkbox checked={props.selectedResourceIds?.includes(resource.id)} />
                            </button>
                        </td>
                        <td class="p-3">
                            <div class="flex flex-col">
                                <span>{resource.name}</span>
                                <span class="text-xs text-muted-foreground">ID: {resource.id}</span>
                            </div>
                        </td>
                        <td class="p-3">
                            <Badge variant="outline">{getResourceTypeDisplay(resource.type)}</Badge>
                        </td>
                        <td class="p-3">
                            <Badge variant="secondary">{getResourceTargetDisplay(resource.target)}</Badge>
                        </td>
                        <td class="p-3">{resource.version || '-'}</td>
                        <td class="p-3">
                            {#if resource.format}
                                <Badge variant={getFormatBadgeVariant(resource.format)} class="whitespace-nowrap">{resource.format.toUpperCase()}</Badge>
                            {:else}
                                -
                            {/if}
                        </td>
                        <td class="p-3">
                            <RelativeDate date={resource.createdAt} />
                        </td>
                    </tr>
                {/each}
            {/if}
        </tbody>
    </table>
    <!-- Pagination -->
    <div class="p-4 border-t">
        <Pagination pagination={props.pagination} emitOnly={true} on:change={handlePaginationChange} />
    </div>
</div>
