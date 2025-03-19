<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { ChevronLeft, ChevronRight } from "lucide-svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { createEventDispatcher } from "svelte";

    export let pagination: {
        page: number;
        per_page: number;
        total_records: number;
        total_pages: number;
    };

    const dispatch = createEventDispatcher();

    // Get visible page numbers with smart truncation
    function getVisiblePages(currentPage: number, totalPages: number) {
        const delta = 1;
        const range = [];
        const rangeWithDots = [];
        let l;

        range.push(1);
        for (let i = currentPage - delta; i <= currentPage + delta; i++) {
            if (i > 1 && i < totalPages) {
                range.push(i);
            }
        }
        if (totalPages > 1) {
            range.push(totalPages);
        }

        for (const i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    }

    // Update URL and navigate
    async function goToPage(page: number) {
        const url = new URL(window.location.href);
        url.searchParams.set('page', page.toString());
        
        // Navigate to new URL
        await goto(`?${url.searchParams.toString()}`, { 
            keepFocus: true,
            noScroll: true
        });
    }

    // Handle per page change
    async function handlePerPageChange(newPerPage: number) {
        const url = new URL(window.location.href);
        url.searchParams.set('per_page', newPerPage.toString());
        url.searchParams.set('page', '1'); // Reset to first page
        
        // Navigate to new URL
        await goto(`?${url.searchParams.toString()}`, { 
            keepFocus: true,
            noScroll: true
        });
    }
</script>

<div class="flex items-center justify-between px-2 py-4">
    <div class="flex items-center gap-2">
        <select
            class="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
            value={pagination.per_page}
            on:change={(e) => handlePerPageChange(parseInt(e.currentTarget.value))}
        >
            {#each [10, 25, 50, 100] as size}
                <option value={size}>{size}</option>
            {/each}
        </select>
        <span class="text-sm text-muted-foreground">/ page</span>
    </div>

    <div class="flex items-center gap-1">
        <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            disabled={pagination.page === 1}
            on:click={() => goToPage(pagination.page - 1)}
        >
            <ChevronLeft class="h-4 w-4" />
        </Button>

        {#each getVisiblePages(pagination.page, pagination.total_pages) as pageNum}
            {#if pageNum === '...'}
                <span class="px-1 text-sm text-muted-foreground">...</span>
            {:else}
                <Button
                    variant={pageNum === pagination.page ? 'default' : 'outline'}
                    size="sm"
                    class="h-8 min-w-[32px]"
                    on:click={() => goToPage(pageNum)}
                >
                    {pageNum}
                </Button>
            {/if}
        {/each}

        <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            disabled={pagination.page === pagination.total_pages}
            on:click={() => goToPage(pagination.page + 1)}
        >
            <ChevronRight class="h-4 w-4" />
        </Button>
    </div>
</div>