<script lang="ts">
    import {
        CreditCard,
        Zap,
        Users,
        HardDrive,
        Calendar,
        Check,
    } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";

    import type { PageData } from "./$types";

    export let data: PageData;

    const pageTitle = "Plan & Billing";
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Settings", ""],
        ["Billing", ""],
    ] as [string, string][];

    // Calculate usage percentages
    $: deviceUsage = Math.min(
        100,
        ((data.billing?.currentDevices ?? 0) /
            (data.billing?.maxDevices ?? 5)) *
            100,
    );
    $: userUsage = Math.min(
        100,
        ((data.billing?.currentUsers ?? 0) / (data.billing?.maxUsers ?? 1)) *
            100,
    );

    // Status color helper
    function getStatusColor(status: string) {
        switch (status) {
            case "active":
                return "bg-green-100 text-green-800";
            case "past_due":
                return "bg-yellow-100 text-yellow-800";
            case "canceled":
                return "bg-red-100 text-red-800";
            default:
                return "bg-gray-100 text-gray-800";
        }
    }
</script>

<UserPageLayout title={pageTitle} crumbs={pageCrumbs}>
    <div class="space-y-6">
        <!-- Current Plan Card -->
        <UserCard
            title="Current Plan"
            description="Your subscription details and usage"
            icon={CreditCard}
        >
            <div class="space-y-6">
                <!-- Plan Info -->
                <div
                    class="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border"
                >
                    <div>
                        <h3 class="text-2xl font-bold">
                            {data.billing?.planName || "Free"}
                        </h3>
                        <div class="flex items-center gap-2 mt-1">
                            <Badge
                                class={getStatusColor(
                                    data.billing?.status || "active",
                                )}
                            >
                                {data.billing?.status || "active"}
                            </Badge>
                            {#if data.subscription?.cancelAtPeriodEnd}
                                <Badge
                                    variant="outline"
                                    class="text-orange-600 border-orange-300"
                                >
                                    Cancels at period end
                                </Badge>
                            {/if}
                        </div>
                    </div>
                    {#if data.billing?.planCode !== "free" && data.subscription}
                        <form method="POST" action="/api/billing/portal">
                            <Button type="submit" variant="outline">
                                Manage Subscription
                            </Button>
                        </form>
                    {/if}
                </div>

                <!-- Usage Stats -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="border rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-3">
                            <HardDrive class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm font-medium">Devices</span>
                        </div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-2xl font-bold"
                                >{data.billing?.currentDevices ?? 0}</span
                            >
                            <span class="text-sm text-muted-foreground"
                                >/ {data.billing?.maxDevices ?? 5}</span
                            >
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div
                                class="h-2 rounded-full transition-all {deviceUsage >
                                90
                                    ? 'bg-red-500'
                                    : deviceUsage > 70
                                      ? 'bg-yellow-500'
                                      : 'bg-primary'}"
                                style="width: {deviceUsage}%"
                            ></div>
                        </div>
                    </div>

                    <div class="border rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-3">
                            <Users class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm font-medium">Users</span>
                        </div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-2xl font-bold"
                                >{data.billing?.currentUsers ?? 0}</span
                            >
                            <span class="text-sm text-muted-foreground"
                                >/ {data.billing?.maxUsers ?? 1}</span
                            >
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div
                                class="h-2 rounded-full transition-all {userUsage >
                                90
                                    ? 'bg-red-500'
                                    : userUsage > 70
                                      ? 'bg-yellow-500'
                                      : 'bg-primary'}"
                                style="width: {userUsage}%"
                            ></div>
                        </div>
                    </div>
                </div>

                <!-- Period Info -->
                {#if data.subscription?.currentPeriodEnd}
                    <div
                        class="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                        <Calendar class="h-4 w-4" />
                        <span
                            >Current period ends: <RelativeDate
                                date={data.subscription.currentPeriodEnd}
                                format="full"
                            /></span
                        >
                    </div>
                {/if}
            </div>
        </UserCard>

        <!-- Upgrade Section (only show for free plan) -->
        {#if data.billing?.planCode === "free"}
            <UserCard
                title="Upgrade Your Plan"
                description="Get more devices, users, and features"
                icon={Zap}
            >
                <div
                    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                    {#each data.plans?.filter((p) => p.code !== "free") || [] as plan}
                        <div
                            class="border rounded-lg p-4 hover:border-primary transition-colors"
                        >
                            <h4 class="font-semibold text-lg mb-2">
                                {plan.name}
                            </h4>
                            <ul
                                class="space-y-2 text-sm text-muted-foreground mb-4"
                            >
                                <li class="flex items-center gap-2">
                                    <Check class="h-4 w-4 text-green-500" />
                                    {plan.maxDevices} devices
                                </li>
                                <li class="flex items-center gap-2">
                                    <Check class="h-4 w-4 text-green-500" />
                                    {plan.maxUsers} users
                                </li>
                                <li class="flex items-center gap-2">
                                    <Check class="h-4 w-4 text-green-500" />
                                    {plan.dataRetentionDays} days data retention
                                </li>
                            </ul>
                            {#if plan.stripePriceId}
                                <form
                                    method="POST"
                                    action="/api/billing/checkout"
                                >
                                    <input
                                        type="hidden"
                                        name="planCode"
                                        value={plan.code}
                                    />
                                    <Button type="submit" class="w-full">
                                        Upgrade to {plan.name}
                                    </Button>
                                </form>
                            {:else}
                                <Button
                                    variant="outline"
                                    class="w-full"
                                    disabled
                                >
                                    Contact Sales
                                </Button>
                            {/if}
                        </div>
                    {/each}
                </div>
            </UserCard>
        {/if}
    </div>
</UserPageLayout>
