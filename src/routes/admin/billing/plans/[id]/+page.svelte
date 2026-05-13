<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, Package, Trash } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Switch } from "$lib/components/ui/switch";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { AlertTriangle } from "lucide-svelte";

    import type { PageData, ActionData } from "./$types";

    export let data: PageData;
    export let form: ActionData;

    // Page configuration
    const entityName = "Plan";
    const listUrl = "/admin/billing/plans";
    const formAction = "?/updatePlan";

    // Form state
    let isSubmitting = false;
    let name = data.plan.name;
    let maxDevices = data.plan.maxDevices;
    let maxUsers = data.plan.maxUsers;
    let maxLogLinesPerMonth = data.plan.maxLogLinesPerMonth;
    let dataRetentionDays = data.plan.dataRetentionDays;
    let isActive = data.plan.isActive;
    let stripePriceId = data.plan.stripePriceId || "";

    // Page title and breadcrumbs
    const title = `Edit ${entityName}: ${data.plan.name}`;
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Billing", ""],
        ["Plans", listUrl],
        data.plan.name,
    ];

    // Handle form results
    $: if (form?.success) {
        toast.success("Plan updated successfully");
        goto(listUrl);
    }

    $: if (form?.error) {
        toast.error(form.error);
    }

    // Format numbers for display
    function formatNumber(value: number): string {
        if (value >= 999999) return "Unlimited";
        if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
        return value.toLocaleString();
    }

    // Action buttons for header
    $: actionButtons = [
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: async () => await goto(listUrl),
            variant: "outline" as const,
            disabled: isSubmitting,
        },
        {
            label: isSubmitting ? "Saving..." : "Save Changes",
            icon: Save,
            onClick: () => {
                const formEl = document.querySelector(
                    `form[action="${formAction}"]`,
                );
                if (formEl) (formEl as HTMLFormElement).requestSubmit();
            },
            disabled: isSubmitting,
            loading: isSubmitting,
        },
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    loading={isSubmitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <!-- Impact Warning -->
    {#if data.plan.subscriptionCount > 0}
        <Alert class="border-amber-500/50 bg-amber-500/5">
            <AlertTriangle class="h-4 w-4 text-amber-500" />
            <AlertDescription>
                <span class="font-medium text-amber-600">Impact Notice:</span>
                This plan has <strong>{data.plan.subscriptionCount}</strong>
                active subscription{data.plan.subscriptionCount !== 1
                    ? "s"
                    : ""}. Changes will affect all subscribed accounts
                immediately.
            </AlertDescription>
        </Alert>
    {/if}

    <form
        method="POST"
        action={formAction}
        on:submit={() => (isSubmitting = true)}
        class="space-y-4"
    >
        <AdminCard
            title="Plan Details"
            description="Configure plan limits and quotas"
            icon={Package}
            compact={true}
        >
            <div class="space-y-6">
                <!-- Row 1: Name and Status -->
                <FormRow columns={2}>
                    <FormField
                        id="name"
                        label="Display Name"
                        required={true}
                        helpText="Shown to customers"
                    >
                        <Input
                            id="name"
                            name="name"
                            bind:value={name}
                            placeholder="Starter"
                            required
                        />
                    </FormField>

                    <FormField
                        id="code"
                        label="Plan Code"
                        helpText="Unique identifier (read-only)"
                    >
                        <Input
                            id="code"
                            value={data.plan.code}
                            readonly
                            disabled
                            class="bg-muted/50"
                        />
                    </FormField>
                </FormRow>

                <!-- Row 2: Devices and Users -->
                <FormRow columns={2}>
                    <FormField
                        id="maxDevices"
                        label="Max Devices"
                        required={true}
                        helpText="Device limit for this plan"
                    >
                        <Input
                            id="maxDevices"
                            name="maxDevices"
                            type="number"
                            min="1"
                            bind:value={maxDevices}
                            required
                        />
                    </FormField>

                    <FormField
                        id="maxUsers"
                        label="Max Users"
                        required={true}
                        helpText="User limit for this plan"
                    >
                        <Input
                            id="maxUsers"
                            name="maxUsers"
                            type="number"
                            min="1"
                            bind:value={maxUsers}
                            required
                        />
                    </FormField>
                </FormRow>

                <!-- Row 3: Retention and Logs -->
                <FormRow columns={2}>
                    <FormField
                        id="dataRetentionDays"
                        label="Data Retention (days)"
                        required={true}
                        helpText="How long to keep data"
                    >
                        <Input
                            id="dataRetentionDays"
                            name="dataRetentionDays"
                            type="number"
                            min="1"
                            bind:value={dataRetentionDays}
                            required
                        />
                    </FormField>

                    <FormField
                        id="maxLogLinesPerMonth"
                        label="Max Logs/Month"
                        required={true}
                        helpText="{formatNumber(maxLogLinesPerMonth)} logs"
                    >
                        <Input
                            id="maxLogLinesPerMonth"
                            name="maxLogLinesPerMonth"
                            type="number"
                            min="0"
                            bind:value={maxLogLinesPerMonth}
                            required
                        />
                    </FormField>
                </FormRow>

                <!-- Row 4: Stripe and Status -->
                <FormRow columns={2}>
                    <FormField
                        id="stripePriceId"
                        label="Stripe Price ID"
                        helpText="Leave empty for free/enterprise plans"
                    >
                        <Input
                            id="stripePriceId"
                            name="stripePriceId"
                            placeholder="price_xxx"
                            bind:value={stripePriceId}
                        />
                    </FormField>

                    <FormField
                        id="isActive"
                        label="Plan Status"
                        helpText="Enable for new subscriptions"
                    >
                        <div class="flex items-center gap-3 h-10">
                            <Switch id="isActive" bind:checked={isActive} />
                            <span class="text-sm font-medium">
                                {isActive ? "Active" : "Inactive"}
                            </span>
                            <input
                                type="hidden"
                                name="isActive"
                                value={isActive}
                            />
                        </div>
                    </FormField>
                </FormRow>
            </div>

            <svelte:fragment slot="footer">
                <MetadataFooter
                    showBorder={false}
                    layout="compact"
                    items={[
                        {
                            label: "ID:",
                            value: data.plan.id,
                            icon: "id",
                        },
                        {
                            label: "Subscriptions:",
                            value: String(data.plan.subscriptionCount),
                            icon: "users",
                        },
                    ]}
                />
            </svelte:fragment>
        </AdminCard>
    </form>
</AdminPageLayout>
