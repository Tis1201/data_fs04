<script lang="ts">
    import { cn } from "$lib/utils";
    import { createEventDispatcher } from "svelte";

    export let currentPage = 1;
    export let totalPages = 1;
    export let maxPages = 5;
    export let showEdges = true;
    export let className: string | undefined = undefined;

    const dispatch = createEventDispatcher<{
        change: number;
    }>();

    $: pages = generatePages(currentPage, totalPages, maxPages, showEdges);

    function generatePages(current: number, total: number, max: number, edges: boolean) {
        const items = [];
        const maxPagesBeforeCurrentPage = Math.floor(max / 2);
        const maxPagesAfterCurrentPage = Math.ceil(max / 2) - 1;
        let startPage: number;
        let endPage: number;

        if (total <= max) {
            startPage = 1;
            endPage = total;
        } else {
            if (current <= maxPagesBeforeCurrentPage) {
                startPage = 1;
                endPage = max;
            } else if (current + maxPagesAfterCurrentPage >= total) {
                startPage = total - max + 1;
                endPage = total;
            } else {
                startPage = current - maxPagesBeforeCurrentPage;
                endPage = current + maxPagesAfterCurrentPage;
            }
        }

        // Add first page if not included
        if (edges && startPage > 1) {
            items.push({ type: 'page', value: 1, key: 'first' });
            if (startPage > 2) {
                items.push({ type: 'ellipsis', key: 'firstEllipsis' });
            }
        }

        // Add pages
        for (let i = startPage; i <= endPage; i++) {
            items.push({
                type: 'page',
                value: i,
                key: i.toString(),
                active: i === current
            });
        }

        // Add last page if not included
        if (edges && endPage < total) {
            if (endPage < total - 1) {
                items.push({ type: 'ellipsis', key: 'lastEllipsis' });
            }
            items.push({ type: 'page', value: total, key: 'last' });
        }

        return items;
    }
</script>

<nav class={cn("flex w-full justify-center", className)} aria-label="pagination">
    <slot {pages} />
</nav>
