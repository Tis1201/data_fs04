<script lang="ts">
    import {
        Receipt,
        Building2,
        ExternalLink,
        AlertTriangle,
    } from "lucide-svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import Card from "$lib/components/ui/card/card.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;

    const pageTitle = "Subscriptions";
    const pageCrumbs = [
        ["Dashboard", "/admin/dashboard"],
        ["Billing", ""],
        ["Subscriptions", ""],
    ] as [string, string][];

    function getStatusColor(status: string) {
        switch (status) {
            case "active":
                return "bg-green-100 text-green-800";
            case "trialing":
                return "bg-blue-100 text-blue-800";
            case "past_due":
                return "bg-amber-100 text-amber-800";
            case "canceled":
                return "bg-red-100 text-red-800";
            case "pending_cancel":
                return "bg-orange-100 text-orange-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    }

    function getSourceLabel(source: string) {
        return source === "stripe" ? "Stripe" : "License";
    }
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

        {#if data.subscriptions.length === 0}
            <Card class="p-8 text-center">
                <Receipt class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 class="font-medium text-lg">No Subscriptions Yet</h3>
                <p class="text-muted-foreground mt-2">
                    Subscriptions will appear here when customers upgrade from
                    the Free plan.
                </p>
            </Card>
        {:else}
            <div class="border rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-muted/50">
                        <tr>
                            <th class="text-left p-3 font-medium">Account</th>
                            <th class="text-left p-3 font-medium">Plan</th>
                            <th class="text-left p-3 font-medium">Status</th>
                            <th class="text-left p-3 font-medium">Source</th>
                            <th class="text-left p-3 font-medium">Period End</th
                            >
                            <th class="text-left p-3 font-medium">Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.subscriptions as sub}
                            <tr
                                class="border-t hover:bg-muted/25 transition-colors"
                            >
                                <td class="p-3">
                                    <a
                                        href="/admin/accounts/{sub.accountSlug}"
                                        class="flex items-center gap-2 hover:text-primary"
                                    >
                                        <Building2
                                            class="h-4 w-4 text-muted-foreground"
                                        />
                                        <span class="font-medium"
                                            >{sub.accountName}</span
                                        >
                                    </a>
                                </td>
                                <td class="p-3">
                                    <Badge variant="outline"
                                        >{sub.planName}</Badge
                                    >
                                </td>
                                <td class="p-3">
                                    <span
                                        class="inline-flex items-center gap-1.5"
                                    >
                                        <Badge
                                            class={getStatusColor(sub.status)}
                                        >
                                            {sub.status}
                                        </Badge>
                                        {#if sub.cancelAtPeriodEnd}
                                            <AlertTriangle
                                                class="h-4 w-4 text-amber-500"
                                            />
                                        {/if}
                                    </span>
                                </td>
                                <td class="p-3 text-muted-foreground">
                                    {getSourceLabel(sub.source)}
                                </td>
                                <td class="p-3">
                                    {#if sub.currentPeriodEnd}
                                        <RelativeDate
                                            date={sub.currentPeriodEnd}
                                        />
                                    {:else}
                                        <span class="text-muted-foreground"
                                            >—</span
                                        >
                                    {/if}
                                </td>
                                <td class="p-3 text-muted-foreground">
                                    <RelativeDate date={sub.updatedAt} />
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</AdminPageLayout>
