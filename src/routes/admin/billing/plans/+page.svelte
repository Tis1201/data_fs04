<script lang="ts">
    import { ExternalLink } from "lucide-svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Button } from "$lib/components/ui/button";
    import PlansTable from "./table.svelte";
    import {
        getDefaultPagination,
        getDefaultSort,
        initPagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { PageData } from "./$types";

    export let data: PageData;

    const pageTitle = "Plans";
    const pageCrumbs = [
        ["Dashboard", "/admin/dashboard"],
        ["Billing", ""],
        ["Plans", ""],
    ] as [string, string][];

    // Set up table props
    $: tableProps = {
        records: data.plans || [],
        pagination: getDefaultPagination(data.meta, 10),
        sort: getDefaultSort(data.meta, "name", "asc"),
        loading: false,
    };

    initPagination("preferredPageSize", true);
</script>

<AdminPageLayout title={pageTitle} crumbs={pageCrumbs}>
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <p class="text-muted-foreground">
                Manage subscription plans. Create products in Stripe Dashboard
                and update price IDs here.
            </p>
            <a
                href="https://dashboard.stripe.com/products"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Button variant="outline" size="sm">
                    <ExternalLink class="h-4 w-4 mr-2" />
                    Open Stripe Dashboard
                </Button>
            </a>
        </div>

        <PlansTable props={tableProps} />
    </div>
</AdminPageLayout>
