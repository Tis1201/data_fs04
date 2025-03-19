<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import {
      Select,
      SelectContent,
      SelectItem,
      SelectTrigger,
      SelectValue,
      SelectGroup,
    } from "$lib/components/ui/select";
    import {
      ChevronLeft,
      ChevronRight,
      ChevronsLeft,
      ChevronsRight,
    } from "lucide-svelte";
    import { goto } from "$app/navigation";
  
    export let pagination: {
      page: number;
      per_page: number;
      total_records: number;
      total_pages: number;
    };
  
    export let baseUrl: string =
      typeof window !== "undefined" ? window.location.href : "/";
    export let resetPage: boolean = true;
  
    const perPageOptions = [10, 20, 30, 40, 50];
  
    $: currentPerPage = pagination?.per_page ?? 10;
  
    // Dynamically calculate total pages and page numbers
    $: totalPages = Math.ceil(pagination.total_records / currentPerPage);
    $: pageNumbers = generatePageNumbers(pagination.page, totalPages);
  
    function generatePageNumbers(currentPage: number, totalPages: number) {
      const delta = 2;
      const range: (number | string)[] = [];
      range.push(1);
  
      let start = Math.max(2, currentPage - delta);
      let end = Math.min(totalPages - 1, currentPage + delta);
  
      if (start > 2) range.push("...");
      for (let i = start; i <= end; i++) range.push(i);
      if (end < totalPages - 1) range.push("...");
      if (totalPages > 1) range.push(totalPages);
  
      return range;
    }
  
    function updateQueryParams(
      updates: Record<string, string | number>,
      resetPage: boolean = false
    ) {
      if (typeof window === "undefined") {
        console.warn("updateQueryParams skipped in SSR environment");
        return;
      }
  
      const url = new URL(baseUrl);
  
      // Ensure `per_page` is always in the query
      if (!updates.per_page) {
        updates.per_page = currentPerPage;
      }
  
      Object.entries(updates).forEach(([key, value]) => {
        url.searchParams.set(key, value.toString());
      });
  
      if (resetPage && !updates.page) {
        url.searchParams.set("page", "1");
      }
  
      goto(url.toString(), { replaceState: true, noScroll: true });
    }
  
    function handlePageChange(pageIndex: number) {
      if (pageIndex !== pagination.page) {
        updateQueryParams({ page: pageIndex });
      }
    }
  
    function handlePerPageChange(event: { value: string; label: string }) {
      const newPerPage = parseInt(event.value);
      if (newPerPage !== pagination.per_page) {
        updateQueryParams({ per_page: newPerPage, page: 1 });
      }
    }
  </script>
  
  <div class="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4">
    <div class="flex items-center gap-4 text-sm text-muted-foreground">
      <span>Show</span>
      <Select
        selected={{
          value: currentPerPage.toString(),
          label: currentPerPage.toString(),
        }}
        onSelectedChange={handlePerPageChange}
      >
        <SelectTrigger class="h-8 w-[70px]">
          <SelectValue placeholder={currentPerPage.toString()} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {#each perPageOptions as option}
              <SelectItem value={option.toString()}>{option}</SelectItem>
            {/each}
          </SelectGroup>
        </SelectContent>
      </Select>
      <span>entries</span>
    </div>
  
    <div class="text-sm text-muted-foreground">
      {#if pagination.total_records > 0}
        Showing {(pagination.page - 1) * currentPerPage + 1} to
        {Math.min(pagination.page * currentPerPage, pagination.total_records)} of
        {pagination.total_records} entries
      {:else}
        No entries available
      {/if}
    </div>
  
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        class="h-8 w-8 p-0"
        disabled={pagination.page === 1}
        on:click={() => handlePageChange(1)}
      >
        <ChevronsLeft class="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        class="h-8 w-8 p-0"
        disabled={pagination.page === 1}
        on:click={() => handlePageChange(pagination.page - 1)}
      >
        <ChevronLeft class="h-4 w-4" />
      </Button>
      {#each pageNumbers as pageNumber}
        {#if typeof pageNumber === "number"}
          <Button
            variant={pageNumber === pagination.page ? "default" : "outline"}
            class="h-8 w-8 p-0"
            on:click={() => handlePageChange(pageNumber)}
          >
            {pageNumber}
          </Button>
        {:else}
          <Button variant="outline" class="h-8 w-8 p-0" disabled>
            ...
          </Button>
        {/if}
      {/each}
      <Button
        variant="outline"
        class="h-8 w-8 p-0"
        disabled={pagination.page === totalPages}
        on:click={() => handlePageChange(pagination.page + 1)}
      >
        <ChevronRight class="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        class="h-8 w-8 p-0"
        disabled={pagination.page === totalPages}
        on:click={() => handlePageChange(totalPages)}
      >
        <ChevronsRight class="h-4 w-4" />
      </Button>
    </div>
  </div>
  