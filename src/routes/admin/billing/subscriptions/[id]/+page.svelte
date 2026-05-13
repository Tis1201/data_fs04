<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        ArrowLeft,
        Building2,
        CreditCard,
        Package,
        Calendar,
        Users,
        Router,
        FileText,
        ExternalLink,
        AlertTriangle,
        Clock,
        CheckCircle,
        XCircle,
        Download,
    } from "lucide-svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;

    const { subscription, account, plan, effectiveLimits, invoices } = data;

    // Page configuration
    const title = `Subscription: ${account.name}`;
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Billing", ""],
        ["Subscriptions", "/admin/billing/subscriptions"],
        [account.name, ""],
    ] as [string, string][];

    // Action buttons
    $: actionButtons = [
        {
            label: "Back",
            icon: ArrowLeft,
            onClick: () => goto("/admin/billing/subscriptions"),
            variant: "outline" as const,
        },
        {
            label: "View Account",
            icon: Building2,
            onClick: () => goto(`/admin/accounts/accounts/${account.id}`),
            variant: "outline" as const,
        },
        ...(subscription.stripeSubscriptionId
            ? [
                  {
                      label: "View in Stripe",
                      icon: ExternalLink,
                      onClick: () =>
                          window.open(
                              `https://dashboard.stripe.com/subscriptions/${subscription.stripeSubscriptionId}`,
                              "_blank",
                          ),
                      variant: "outline" as const,
                  },
              ]
            : []),
    ];

    // Status helpers
    function getStatusVariant(
        status: string,
    ): "default" | "secondary" | "destructive" | "outline" {
        switch (status) {
            case "active":
                return "default";
            case "trialing":
                return "secondary";
            case "past_due":
                return "destructive";
            case "canceled":
                return "destructive";
            default:
                return "outline";
        }
    }

    function formatLimit(value: number): string {
        if (value >= 999999) return "Unlimited";
        if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toLocaleString();
    }

    function formatCurrency(amount: number, currency: string): string {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || "USD",
        }).format(amount);
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <!-- Status Banner for Canceling/Problem subscriptions -->
    {#if subscription.cancelAtPeriodEnd}
        <div
            class="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3"
        >
            <AlertTriangle class="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
                <p class="font-medium text-amber-800">Subscription Canceling</p>
                <p class="text-sm text-amber-700">
                    This subscription will cancel at the end of the current
                    period
                    {#if subscription.currentPeriodEnd}
                        on <strong
                            >{new Date(
                                subscription.currentPeriodEnd,
                            ).toLocaleDateString()}</strong
                        >
                    {/if}
                </p>
            </div>
        </div>
    {/if}

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Subscription Details Card -->
        <AdminCard
            title="Subscription Details"
            description="Current subscription status and billing"
            icon={CreditCard}
            compact={true}
        >
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-muted-foreground">Status</p>
                        <div class="flex items-center gap-2 mt-1">
                            <Badge
                                variant={getStatusVariant(subscription.status)}
                            >
                                {subscription.status}
                            </Badge>
                            {#if subscription.cancelAtPeriodEnd}
                                <span class="text-xs text-amber-600"
                                    >(canceling)</span
                                >
                            {/if}
                        </div>
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">Source</p>
                        <p class="font-medium mt-1">
                            {subscription.source === "stripe"
                                ? "Stripe"
                                : "License Key"}
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-muted-foreground">
                            Subscribed On
                        </p>
                        <p class="font-medium mt-1">
                            {new Date(
                                subscription.createdAt,
                            ).toLocaleDateString()}
                        </p>
                        <p class="text-xs text-muted-foreground">
                            <RelativeDate date={subscription.createdAt} />
                        </p>
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">
                            Current Period Ends
                        </p>
                        {#if subscription.currentPeriodEnd}
                            <p class="font-medium mt-1">
                                {new Date(
                                    subscription.currentPeriodEnd,
                                ).toLocaleDateString()}
                            </p>
                            <p class="text-xs text-muted-foreground">
                                <RelativeDate
                                    date={subscription.currentPeriodEnd}
                                />
                            </p>
                        {:else}
                            <p class="text-muted-foreground mt-1">—</p>
                        {/if}
                    </div>
                </div>

                {#if subscription.trialEndsAt}
                    <div class="bg-blue-50 rounded-lg p-3">
                        <p class="text-sm font-medium text-blue-800">
                            Trial Period
                        </p>
                        <p class="text-sm text-blue-700">
                            Ends on {new Date(
                                subscription.trialEndsAt,
                            ).toLocaleDateString()}
                        </p>
                    </div>
                {/if}

                {#if subscription.licenseKey}
                    <div class="bg-purple-50 rounded-lg p-3">
                        <p class="text-sm font-medium text-purple-800">
                            License Key
                        </p>
                        <code class="text-xs text-purple-700 break-all"
                            >{subscription.licenseKey}</code
                        >
                        {#if subscription.licenseExpiresAt}
                            <p class="text-sm text-purple-600 mt-1">
                                Expires: {new Date(
                                    subscription.licenseExpiresAt,
                                ).toLocaleDateString()}
                            </p>
                        {/if}
                    </div>
                {/if}
            </div>

            <svelte:fragment slot="footer">
                <MetadataFooter
                    showBorder={false}
                    layout="compact"
                    items={[
                        { label: "ID:", value: subscription.id, icon: "id" },
                        {
                            label: "Updated:",
                            date: subscription.updatedAt,
                            icon: "clock",
                        },
                    ]}
                />
            </svelte:fragment>
        </AdminCard>

        <!-- Account Info Card -->
        <AdminCard
            title="Account"
            description="Associated account details"
            icon={Building2}
            compact={true}
        >
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-muted-foreground">Account Name</p>
                    <a
                        href="/admin/accounts/accounts/{account.id}"
                        class="font-medium text-blue-600 hover:underline mt-1 block"
                    >
                        {account.name}
                    </a>
                    <p class="text-xs text-muted-foreground">
                        Slug: {account.slug}
                    </p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-sm text-muted-foreground">Status</p>
                        <Badge
                            variant={account.status === "ACTIVE"
                                ? "default"
                                : "secondary"}
                            class="mt-1"
                        >
                            {account.status}
                        </Badge>
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">
                            Account Created
                        </p>
                        <p class="font-medium mt-1">
                            {new Date(account.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex items-center gap-2">
                        <Users class="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p class="text-sm text-muted-foreground">Users</p>
                            <p class="font-medium">
                                {account.memberCount} / {formatLimit(
                                    effectiveLimits.maxUsers,
                                )}
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Router class="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p class="text-sm text-muted-foreground">Devices</p>
                            <p class="font-medium">
                                {account.deviceCount} / {formatLimit(
                                    effectiveLimits.maxDevices,
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </AdminCard>

        <!-- Plan Card -->
        <AdminCard
            title="Plan"
            description="Current subscription plan"
            icon={Package}
            compact={true}
        >
            <div class="space-y-4">
                <div>
                    <p class="text-sm text-muted-foreground">Plan Name</p>
                    <a
                        href="/admin/billing/plans/{plan.id}"
                        class="font-medium text-blue-600 hover:underline mt-1 block"
                    >
                        {plan.name}
                    </a>
                    <p class="text-xs text-muted-foreground">
                        Code: {plan.code}
                    </p>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">Devices</span>
                            <span class="font-medium"
                                >{formatLimit(plan.maxDevices)}</span
                            >
                        </div>
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">Users</span>
                            <span class="font-medium"
                                >{formatLimit(plan.maxUsers)}</span
                            >
                        </div>
                    </div>
                    <div class="space-y-2">
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">Retention</span>
                            <span class="font-medium"
                                >{plan.dataRetentionDays}d</span
                            >
                        </div>
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">Logs/mo</span>
                            <span class="font-medium"
                                >{formatLimit(plan.maxLogLinesPerMonth)}</span
                            >
                        </div>
                    </div>
                </div>

                {#if subscription.overrideMaxDevices || subscription.overrideMaxUsers}
                    <div class="bg-amber-50 rounded-lg p-3">
                        <p class="text-sm font-medium text-amber-800">
                            Custom Overrides
                        </p>
                        <div class="text-sm text-amber-700 mt-1 space-y-1">
                            {#if subscription.overrideMaxDevices}
                                <p>
                                    Devices: {formatLimit(
                                        subscription.overrideMaxDevices,
                                    )} (instead of {formatLimit(
                                        plan.maxDevices,
                                    )})
                                </p>
                            {/if}
                            {#if subscription.overrideMaxUsers}
                                <p>
                                    Users: {formatLimit(
                                        subscription.overrideMaxUsers,
                                    )} (instead of {formatLimit(plan.maxUsers)})
                                </p>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        </AdminCard>

        <!-- Invoices Card -->
        <AdminCard
            title="Billing History"
            description="Recent invoices and payments"
            icon={FileText}
            compact={true}
        >
            {#if invoices.length === 0}
                <div class="text-center py-6 text-muted-foreground">
                    <FileText class="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No invoices found</p>
                    {#if subscription.source !== "stripe"}
                        <p class="text-xs mt-1">
                            This subscription uses license-based billing
                        </p>
                    {/if}
                </div>
            {:else}
                <div class="space-y-3">
                    {#each invoices as invoice}
                        <div
                            class="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                        >
                            <div class="flex items-center gap-3">
                                {#if invoice.status === "paid"}
                                    <CheckCircle
                                        class="h-4 w-4 text-green-500"
                                    />
                                {:else if invoice.status === "open"}
                                    <Clock class="h-4 w-4 text-amber-500" />
                                {:else}
                                    <XCircle class="h-4 w-4 text-red-500" />
                                {/if}
                                <div>
                                    <p class="font-medium text-sm">
                                        {invoice.number || invoice.id}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {#if invoice.paidAt}
                                            Paid {new Date(
                                                invoice.paidAt,
                                            ).toLocaleDateString()}
                                        {:else}
                                            {invoice.status}
                                        {/if}
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="font-medium">
                                    {formatCurrency(
                                        invoice.amount,
                                        invoice.currency,
                                    )}
                                </span>
                                {#if invoice.hostedUrl}
                                    <a
                                        href={invoice.hostedUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-blue-600 hover:text-blue-800"
                                    >
                                        <ExternalLink class="h-4 w-4" />
                                    </a>
                                {/if}
                                {#if invoice.pdfUrl}
                                    <a
                                        href={invoice.pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="text-muted-foreground hover:text-foreground"
                                    >
                                        <Download class="h-4 w-4" />
                                    </a>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>

                {#if subscription.stripeCustomerId}
                    <div class="mt-4 pt-4 border-t">
                        <a
                            href="https://dashboard.stripe.com/customers/{subscription.stripeCustomerId}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        >
                            View all invoices in Stripe
                            <ExternalLink class="h-3 w-3" />
                        </a>
                    </div>
                {/if}
            {/if}
        </AdminCard>
    </div>
</AdminPageLayout>
