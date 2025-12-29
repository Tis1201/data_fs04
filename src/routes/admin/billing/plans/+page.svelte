<script lang="ts">
    import {
        CreditCard,
        Package,
        Users,
        HardDrive,
        Clock,
        Activity,
        Check,
        X,
        ExternalLink,
    } from "lucide-svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import Card from "$lib/components/ui/card/card.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import type { PageData } from "./$types";

    export let data: PageData;

    const pageTitle = "Plans";
    const pageCrumbs = [
        ["Dashboard", "/admin/dashboard"],
        ["Billing", ""],
        ["Plans", ""],
    ] as [string, string][];

    function formatLimit(value: number): string {
        return value >= 999999 ? "Unlimited" : value.toLocaleString();
    }

    function formatLogs(value: number): string {
        if (value >= 999999999) return "Unlimited";
        if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toLocaleString();
    }
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

        <div class="grid gap-4">
            {#each data.plans as plan}
                <Card class="p-6">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <div class="p-3 rounded-lg bg-primary/10">
                                <Package class="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <h3 class="font-semibold text-lg">
                                        {plan.name}
                                    </h3>
                                    <Badge
                                        variant={plan.isActive
                                            ? "default"
                                            : "secondary"}
                                    >
                                        {plan.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                    <code
                                        class="text-xs bg-muted px-2 py-1 rounded"
                                        >{plan.code}</code
                                    >
                                </div>
                                <p class="text-sm text-muted-foreground mt-1">
                                    {plan.subscriptionCount} active subscription{plan.subscriptionCount !==
                                    1
                                        ? "s"
                                        : ""}
                                </p>
                            </div>
                        </div>
                        <div class="text-right">
                            {#if plan.stripePriceId}
                                <div
                                    class="flex items-center gap-1 text-green-600"
                                >
                                    <Check class="h-4 w-4" />
                                    <span class="text-sm">Stripe Connected</span
                                    >
                                </div>
                                <code class="text-xs text-muted-foreground"
                                    >{plan.stripePriceId}</code
                                >
                            {:else if plan.code !== "free" && plan.code !== "enterprise"}
                                <div
                                    class="flex items-center gap-1 text-amber-600"
                                >
                                    <X class="h-4 w-4" />
                                    <span class="text-sm">Missing Price ID</span
                                    >
                                </div>
                            {:else}
                                <span class="text-xs text-muted-foreground"
                                    >N/A</span
                                >
                            {/if}
                        </div>
                    </div>

                    <div
                        class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t"
                    >
                        <div class="flex items-center gap-2">
                            <HardDrive class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm"
                                ><strong>{formatLimit(plan.maxDevices)}</strong> devices</span
                            >
                        </div>
                        <div class="flex items-center gap-2">
                            <Users class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm"
                                ><strong>{formatLimit(plan.maxUsers)}</strong> users</span
                            >
                        </div>
                        <div class="flex items-center gap-2">
                            <Clock class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm"
                                ><strong>{plan.dataRetentionDays}</strong> day retention</span
                            >
                        </div>
                        <div class="flex items-center gap-2">
                            <Activity class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm"
                                ><strong
                                    >{formatLogs(
                                        plan.maxLogLinesPerMonth,
                                    )}</strong
                                > logs/mo</span
                            >
                        </div>
                    </div>

                    {#if plan.features && plan.features.length > 0}
                        <div class="mt-4 flex flex-wrap gap-2">
                            {#each plan.features as feature}
                                <Badge variant="outline" class="text-xs"
                                    >{feature}</Badge
                                >
                            {/each}
                        </div>
                    {/if}
                </Card>
            {/each}
        </div>
    </div>
</AdminPageLayout>
