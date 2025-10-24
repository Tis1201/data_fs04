<script lang="ts">
    import DeviceTable from "./table.svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { Plus, CheckCircle } from "lucide-svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import { initPagination, getDefaultPagination, getDefaultSort } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { PageData } from "./$types";
    import { sseStore } from "$lib/stores/sse-store";
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { Card, CardContent } from "$lib/components/ui/card";
    
    // Import page data
    export let data: PageData;
    
    // Extract data from the server
    $: ({ preclaimSets: records, meta } = data);
    $: pagination = getDefaultPagination(meta, 10);
    $: sort = getDefaultSort(meta, "createdAt", "desc");
    $: props = { records: records as any, pagination, sort, loading };
    
    let loading = false;
    let showSuccessMessage = false;
    let successMessage = '';
    
    // Initialize pagination with stored preferences
    initPagination('preferredPageSize', true);

    // Define breadcrumbs - using the correct format for crumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["IoT", "/user/iot"],
        ["Preclaims", ""]
    ] as [string, string][];

    // Handle success message from URL parameters
    onMount(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const name = urlParams.get('name');
        const id = urlParams.get('id');
        
        if (success === 'created') {
            if (name && id) {
                successMessage = `Preclaim set "${decodeURIComponent(name)}" created successfully!`;
                showSuccessMessage = true;
                
                // Show toast notification
                toast.success(successMessage);
                
                // Clean up URL parameters
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('success');
                newUrl.searchParams.delete('name');
                newUrl.searchParams.delete('id');
                window.history.replaceState({}, '', newUrl.toString());
                
                // Auto-hide success message after 5 seconds
                setTimeout(() => {
                    showSuccessMessage = false;
                }, 5000);
            } else {
                successMessage = 'Preclaim set created successfully!';
                showSuccessMessage = true;
                toast.success(successMessage);
                
                // Clean up URL parameters
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('success');
                window.history.replaceState({}, '', newUrl.toString());
                
                // Auto-hide success message after 5 seconds
                setTimeout(() => {
                    showSuccessMessage = false;
                }, 5000);
            }
        }
        
        // try {
        //     sseStore.connect(`/api/sse`, { withCredentials: true });
        // } catch (e) {
        //     // ignore if already connected
        // }
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title="Preclaim Sets">
        <svelte:fragment slot="action">
            <ActionButton
                label="Add Preclaim Set"
                icon={Plus}
                onClick={() => goto('/user/iot/preclaims/new')}
            />
        </svelte:fragment>
    </PageHeader>

    {#if showSuccessMessage}
        <Card class="w-full mb-4 border-green-200 bg-green-50">
            <CardContent class="pt-4">
                <div class="flex items-center gap-3">
                    <CheckCircle class="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p class="text-green-800 font-medium">{successMessage}</p>
                </div>
            </CardContent>
        </Card>
    {/if}

    <DeviceTable {props} />
</PageContainer>