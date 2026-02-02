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
        /** When true, hide the filter row (search + format); used when parent provides single search, e.g. Add App modal. */
        hideFilters?: boolean;
    }
    export let props: TableProps;
    $: hideFilters = props.hideFilters ?? false;

    const dispatch = createEventDispatcher<{
        rowClick: Resource;
        toggleSelectAllClick: void;
        sort: { field: string; order: 'asc' | 'desc' };
        pagination: { page: number; per_page: number };
        filter: { search?: string; formats?: string[] };
    }>();

    // Function to reset internal filter state
    function resetFilters() {
        localSearch = '';
        localFormats = [];
        selectedFormats.set([]);
        emitFilter();
    }

    // Internal filter state; emit to parent
    let localSearch = '';
    let localFormats: string[] = [];
    
    // Calculate if all items are selected
    $: allSelected = props.records.length > 0 && props.records.every((r) => props.selectedResourceIds?.includes(r.id));
    
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

    function getFormatBadgeVariant(format: string | null) {
        if (!format) return 'outline';
        const formatVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
            apk: 'default', bin: 'secondary', exe: 'destructive', sh: 'secondary'
        };
        return formatVariants[format] || 'outline';
    }
</script>

<div class="w-full">
    <!-- Filters (hidden when parent provides single search, e.g. Add App modal) -->
    {#if !hideFilters}
        <div class="p-4 border-b flex flex-col sm:flex-row gap-2">
            <div class="flex-1 min-w-0">
                <DebouncedTextFilter
                    placeholder="Search by app name..."
                    value={localSearch}
                    emitOnly={true}
                    delay={0}
                    on:change={handleSearchChange}
                />
            </div>
            <div class="flex-shrink-0">
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
        </div>
    {/if}

    <!-- Table with scrollable body only -->
    <div class="overflow-y-auto max-h-[400px] border-t">
        <table class="w-full">
        <thead class="sticky top-0 bg-background z-10 border-b">
            <tr>
                <th class="w-10 p-3">
                    <button type="button" class="inline-flex" on:click|stopPropagation={() => dispatch('toggleSelectAllClick')} aria-label="Select all">
                        <Checkbox checked={allSelected} aria-label="Select all" />
                    </button>
                </th>
                <th class="text-left p-3">
                    <button class="p-0 font-medium text-sm flex items-center" on:click={() => handleSortClick('name')}>
                        Name
                    </button>
                </th>
                <th class="text-left p-3">Package</th>
                <th class="text-left p-3">Version</th>
                <th class="text-left p-3">Format</th>
                <th class="text-left p-3">Release Type</th>
                <th class="text-left p-3">Created</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-border">
            {#if props.records.length === 0}
                <tr>
                    <td colspan="8" class="text-center p-4 text-muted-foreground">No apps found</td>
                </tr>
            {:else}
                {#each props.records as resource}
                    <tr class="hover:bg-muted/50 cursor-pointer" on:click={() => dispatch('rowClick', resource)}>
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
                            <span class="text-xs text-muted-foreground">{resource.packageName || '-'}</span>
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
                            <Badge variant="outline">{resource?.releaseType || 'None'}</Badge>
                        </td>
                        <td class="p-3">
                            <RelativeDate date={resource.createdAt} />
                        </td>
                    </tr>
                {/each}
            {/if}
        </tbody>
        </table>
    </div>
</div>
