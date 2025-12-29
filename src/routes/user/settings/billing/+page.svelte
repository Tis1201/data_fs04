<script lang="ts">
    import {
        CreditCard,
        Zap,
        Users,
        HardDrive,
        Calendar,
        Check,
        Crown,
        Sparkles,
        Shield,
        Headphones,
        Activity,
        Clock,
        Lock,
        Server,
        ShieldCheck,
        BarChart,
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

    // Plan metadata (pricing, recommended, description)
    const planMeta: Record<
        string,
        { price: string; recommended?: boolean; tagline: string; icon: any }
    > = {
        free: {
            price: "Free forever",
            tagline: "For individuals getting started",
            icon: Sparkles,
        },
        starter: {
            price: "$199/mo",
            tagline: "For growing teams",
            icon: Zap,
        },
        business: {
            price: "$499/mo",
            recommended: true,
            tagline: "For scaling organizations",
            icon: Crown,
        },
        enterprise: {
            price: "Custom pricing",
            tagline: "For large deployments with dedicated support",
            icon: Shield,
        },
    };

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

    // Usage bar color - green safe, amber warning, only red if over limit
    function getUsageColor(usage: number): string {
        if (usage >= 100) return "bg-amber-500"; // At limit = warning, not error
        if (usage >= 80) return "bg-amber-400"; // Near limit
        return "bg-primary"; // Safe
    }

    // Format limit for display
    function formatLimit(value: number): string {
        return value >= 999999 ? "Unlimited" : value.toLocaleString();
    }

    // Format log lines (10K, 500K, 5M, Unlimited)
    function formatLogs(value: number): string {
        if (value >= 999999999) return "Unlimited";
        if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toLocaleString();
    }

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

    // Get all plans sorted for comparison table
    $: allPlans = (data.plans || []).sort(
        (a, b) => a.maxDevices - b.maxDevices,
    );

    // Get current plan data from the plans list
    $: currentPlanData = allPlans.find(
        (p) => p.code === data.billing?.planCode,
    );

    // Check if user is at a limit
    $: atDeviceLimit =
        (data.billing?.currentDevices ?? 0) >= (data.billing?.maxDevices ?? 5);
    $: atUserLimit =
        (data.billing?.currentUsers ?? 0) >= (data.billing?.maxUsers ?? 1);
</script>

<UserPageLayout title={pageTitle} crumbs={pageCrumbs}>
    <div class="space-y-8 max-w-5xl">
        <!-- Current Plan Card -->
        <UserCard
            title="Current Plan"
            description="Your subscription details and usage"
            icon={CreditCard}
        >
            <div class="space-y-6">
                <!-- Plan Header -->
                <div
                    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border"
                >
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-primary/20 rounded-lg">
                            <svelte:component
                                this={planMeta[data.billing?.planCode || "free"]
                                    ?.icon || Sparkles}
                                class="h-6 w-6 text-primary"
                            />
                        </div>
                        <div>
                            <h3 class="text-xl font-bold">
                                {data.billing?.planName || "Free"}
                            </h3>
                            <p class="text-sm text-muted-foreground">
                                {planMeta[data.billing?.planCode || "free"]
                                    ?.tagline || "Your current plan"}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <Badge
                            class={getStatusColor(
                                data.billing?.status || "active",
                            )}
                        >
                            {data.billing?.status || "active"}
                        </Badge>
                        {#if data.billing?.planCode !== "free" && data.subscription}
                            <form method="POST" action="/api/billing/portal">
                                <Button
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                >
                                    Manage Subscription
                                </Button>
                            </form>
                        {/if}
                    </div>
                </div>

                <!-- Usage Stats -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Devices -->
                    <div
                        class="border rounded-lg p-4 {atDeviceLimit
                            ? 'border-amber-300 bg-amber-50/50'
                            : ''}"
                    >
                        <div class="flex items-center gap-2 mb-3">
                            <HardDrive class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm font-medium">Devices</span>
                            {#if atDeviceLimit}
                                <Badge
                                    variant="outline"
                                    class="text-amber-600 border-amber-300 text-xs"
                                >
                                    At limit
                                </Badge>
                            {/if}
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
                                class="h-2 rounded-full transition-all {getUsageColor(
                                    deviceUsage,
                                )}"
                                style="width: {deviceUsage}%"
                            ></div>
                        </div>
                    </div>

                    <!-- Users -->
                    <div
                        class="border rounded-lg p-4 {atUserLimit
                            ? 'border-amber-300 bg-amber-50/50'
                            : ''}"
                    >
                        <div class="flex items-center gap-2 mb-3">
                            <Users class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm font-medium">Team Members</span
                            >
                            {#if atUserLimit}
                                <Badge
                                    variant="outline"
                                    class="text-amber-600 border-amber-300 text-xs"
                                >
                                    At limit
                                </Badge>
                            {/if}
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
                                class="h-2 rounded-full transition-all {getUsageColor(
                                    userUsage,
                                )}"
                                style="width: {userUsage}%"
                            ></div>
                        </div>
                    </div>

                    <!-- Logs -->
                    <div class="border rounded-lg p-4">
                        <div class="flex items-center gap-2 mb-3">
                            <Activity class="h-4 w-4 text-muted-foreground" />
                            <span class="text-sm font-medium">Logs</span>
                        </div>
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-2xl font-bold"
                                >{formatLogs(
                                    data.billing?.currentLogLines ?? 0,
                                )}</span
                            >
                            <span class="text-sm text-muted-foreground"
                                >/ {formatLogs(
                                    data.billing?.maxLogLinesPerMonth ?? 10000,
                                )}</span
                            >
                        </div>
                        <!-- Log usage bar (always < 1% for now as logic is mocked) -->
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div
                                class="h-2 rounded-full transition-all bg-primary"
                                style="width: 1%"
                            ></div>
                        </div>
                    </div>
                </div>

                <!-- Limit Warning -->
                {#if atDeviceLimit || atUserLimit}
                    <div
                        class="p-3 bg-amber-50 border border-amber-200 rounded-lg"
                    >
                        <p class="text-sm text-amber-800">
                            <strong>You've reached your plan limit.</strong>
                            {#if atDeviceLimit && atUserLimit}
                                Upgrade to add more devices and team members.
                            {:else if atDeviceLimit}
                                Upgrade to add more devices to your account.
                            {:else}
                                Upgrade to invite more team members.
                            {/if}
                        </p>
                    </div>
                {/if}

                <!-- Billing Period -->
                {#if data.subscription?.currentPeriodEnd}
                    <div
                        class="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t"
                    >
                        <Calendar class="h-4 w-4" />
                        <span
                            >Current billing period ends: <RelativeDate
                                date={data.subscription.currentPeriodEnd}
                                format="full"
                            /></span
                        >
                    </div>
                {/if}
            </div>
        </UserCard>

        <!-- Friction Nudge -->
        {#if atDeviceLimit || atUserLimit}
            <div
                class="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3"
            >
                <div class="bg-amber-100 p-2 rounded-full">
                    <Zap class="h-5 w-5 text-amber-600" />
                </div>
                <div>
                    <h4 class="font-semibold text-amber-900">
                        You've reached your plan limits
                    </h4>
                    <p class="text-amber-700 text-sm mt-1">
                        {#if atDeviceLimit && atUserLimit}
                            You've hit both device and user limits. Upgrade to
                            unlock more capacity.
                        {:else if atDeviceLimit}
                            You've reached your device limit. Upgrade to add
                            more devices.
                        {:else}
                            You've reached your team member limit. Upgrade to
                            invite more users.
                        {/if}
                    </p>
                </div>
            </div>
        {/if}

        <!-- Plans Comparison Section -->
        {#if allPlans.length > 0}
            <UserCard
                title="Compare Plans"
                description="Choose the plan that fits your needs — scale confidently."
                icon={Zap}
            >
                <div
                    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                    {#each allPlans as plan}
                        {@const meta = planMeta[plan.code] || {
                            price: "Contact Sales",
                            tagline: "",
                            icon: Sparkles,
                        }}
                        {@const isRecommended = meta.recommended}
                        {@const isCurrentPlan =
                            plan.code === data.billing?.planCode}
                        {@const isBusiness = plan.code === "business"}
                        <div
                            class="relative border rounded-xl p-6 transition-all hover:shadow-lg flex flex-col h-full
                            {isCurrentPlan
                                ? 'border-green-500 ring-2 ring-green-200 bg-green-50/30'
                                : isBusiness
                                  ? 'border-purple-200 shadow-md bg-gradient-to-b from-purple-50/50 to-transparent'
                                  : isRecommended
                                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                                    : 'hover:border-gray-300'}"
                        >
                            <!-- Plan Badge -->
                            {#if isCurrentPlan}
                                <div
                                    class="absolute -top-3 left-1/2 -translate-x-1/2"
                                >
                                    <Badge class="bg-green-600 text-white">
                                        Current Plan
                                    </Badge>
                                </div>
                            {:else if isRecommended}
                                <div
                                    class="absolute -top-3 left-1/2 -translate-x-1/2"
                                >
                                    <Badge
                                        class="bg-primary text-primary-foreground"
                                    >
                                        Recommended
                                    </Badge>
                                </div>
                            {/if}

                            <!-- Plan Header -->
                            <div class="text-center mb-6 pt-2">
                                <div
                                    class="inline-flex p-3 rounded-xl mb-3 {isBusiness
                                        ? 'bg-purple-100'
                                        : 'bg-gray-100'}"
                                >
                                    <svelte:component
                                        this={meta.icon}
                                        class="h-6 w-6 {isBusiness
                                            ? 'text-purple-600'
                                            : 'text-gray-600'}"
                                    />
                                </div>
                                <h4 class="font-bold text-xl">{plan.name}</h4>
                                <p
                                    class="text-2xl font-bold text-slate-900 mt-2"
                                >
                                    {meta.price}
                                </p>
                                <p
                                    class="text-xs text-muted-foreground mt-2 min-h-[40px] px-2 leading-relaxed"
                                >
                                    {meta.tagline}
                                </p>
                            </div>

                            <!-- Features -->
                            <ul class="space-y-3 text-sm mb-8 flex-grow">
                                <li class="flex items-center gap-3">
                                    <HardDrive
                                        class="h-4 w-4 text-slate-400 flex-shrink-0"
                                    />
                                    <span
                                        ><strong
                                            >{formatLimit(
                                                plan.maxDevices,
                                            )}</strong
                                        > devices</span
                                    >
                                </li>
                                <li class="flex items-center gap-3">
                                    <Users
                                        class="h-4 w-4 text-slate-400 flex-shrink-0"
                                    />
                                    <span
                                        ><strong
                                            >{formatLimit(
                                                plan.maxUsers,
                                            )}</strong
                                        > team members</span
                                    >
                                </li>
                                <li class="flex items-center gap-3">
                                    <Clock
                                        class="h-4 w-4 text-slate-400 flex-shrink-0"
                                    />
                                    <span
                                        ><strong
                                            >{plan.dataRetentionDays}-day</strong
                                        > retention</span
                                    >
                                </li>
                                <li class="flex items-center gap-3">
                                    <Activity
                                        class="h-4 w-4 text-slate-400 flex-shrink-0"
                                    />
                                    <span
                                        ><strong
                                            >{formatLogs(
                                                plan.maxLogLinesPerMonth ||
                                                    10000,
                                            )}</strong
                                        > logs/mo</span
                                    >
                                </li>

                                {#if plan.code === "starter"}
                                    <li class="flex items-center gap-3">
                                        <Check
                                            class="h-4 w-4 text-green-500 flex-shrink-0"
                                        />
                                        <span>Email support</span>
                                    </li>
                                {/if}

                                {#if plan.code === "business"}
                                    <li class="flex items-center gap-3">
                                        <Check
                                            class="h-4 w-4 text-green-500 flex-shrink-0"
                                        />
                                        <span>Email Support</span>
                                    </li>
                                    <li class="flex items-center gap-3">
                                        <Check
                                            class="h-4 w-4 text-green-500 flex-shrink-0"
                                        />
                                        <span>Standard SLA</span>
                                    </li>
                                {/if}

                                {#if plan.code === "enterprise"}
                                    <li class="flex items-center gap-3">
                                        <ShieldCheck
                                            class="h-4 w-4 text-green-500 flex-shrink-0"
                                        />
                                        <span>SSO & SAML</span>
                                    </li>
                                    <li class="flex items-center gap-3">
                                        <Server
                                            class="h-4 w-4 text-green-500 flex-shrink-0"
                                        />
                                        <span>Dedicated instance</span>
                                    </li>
                                    <li class="flex items-center gap-3">
                                        <Lock
                                            class="h-4 w-4 text-green-500 flex-shrink-0"
                                        />
                                        <span>SOC2 / ISO compl.</span>
                                    </li>
                                    <li class="flex items-center gap-3">
                                        <BarChart
                                            class="h-4 w-4 text-green-500 flex-shrink-0"
                                        />
                                        <span>99.9% Uptime SLA</span>
                                    </li>
                                {/if}
                            </ul>

                            <!-- CTA -->
                            <div class="mt-auto pt-4 border-t border-gray-100">
                                {#if isCurrentPlan}
                                    <Button
                                        variant="ghost"
                                        class="w-full bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 font-medium"
                                        disabled
                                    >
                                        <Check class="h-4 w-4 mr-2" />
                                        Current Plan
                                    </Button>
                                {:else if plan.code === "enterprise"}
                                    <a
                                        href="mailto:sales@example.com?subject=Enterprise Plan Inquiry"
                                        class="block"
                                    >
                                        <Button
                                            variant="outline"
                                            class="w-full hover:border-slate-400 hover:text-slate-900 transition-colors"
                                        >
                                            Contact Sales
                                        </Button>
                                    </a>
                                {:else if plan.code === "free"}
                                    <Button
                                        variant="ghost"
                                        class="w-full text-muted-foreground bg-slate-50"
                                        disabled
                                    >
                                        Free Forever
                                    </Button>
                                {:else if plan.stripePriceId}
                                    <form
                                        method="POST"
                                        action="/api/billing/checkout"
                                    >
                                        <input
                                            type="hidden"
                                            name="planCode"
                                            value={plan.code}
                                        />
                                        <Button
                                            type="submit"
                                            class="w-full {isBusiness
                                                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                                                : ''}"
                                            variant={isRecommended
                                                ? "default"
                                                : "outline"}
                                        >
                                            Upgrade
                                        </Button>
                                    </form>
                                {:else}
                                    <Button
                                        class="w-full {isBusiness
                                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                                            : ''}"
                                        variant={isRecommended
                                            ? "default"
                                            : "outline"}
                                    >
                                        Upgrade to {plan.name}
                                    </Button>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </UserCard>
        {/if}
    </div>
</UserPageLayout>
