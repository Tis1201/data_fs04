<script lang="ts">
    import { ExternalLink } from "lucide-svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Button } from "$lib/components/ui/button";
    import SubscriptionsTable from "./table.svelte";
    import {
        getDefaultPagination,
        getDefaultSort,
        initPagination,
    } from "$lib/components/ui_components_sveltekit/table/pagination/pagination-utils";
    import type { PageData } from "./$types";

    export let data: PageData;

    const pageTitle = "Subscriptions";
    const pageCrumbs = [
        ["Dashboard", "/admin/dashboard"],
        ["Billing", ""],
        ["Subscriptions", ""],
    ] as [string, string][];

    // Set up table props
    $: tableProps = {
        records: data.subscriptions || [],
        pagination: getDefaultPagination(data.meta, 50),
        sort: getDefaultSort(data.meta, "updatedAt", "desc"),
        loading: false,
    };

    initPagination("preferredPageSize", true);
</script>

<AdminPageLayout title={pageTitle} crumbs={pageCrumbs}>
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <p class="text-muted-foreground">
                View and manage customer subscriptions. Click account to view
                details.
            </p>
            <a
                href="https://dashboard.stripe.com/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Button variant="outline" size="sm">
                    <ExternalLink class="h-4 w-4 mr-2" />
                    View in Stripe
                </Button>
            </a>
        </div>

        <SubscriptionsTable props={tableProps} />
    </div>
</AdminPageLayout>
