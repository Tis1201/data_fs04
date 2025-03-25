<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Select from "$lib/components/ui/select/index.js";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
    const { account } = data;
    const isNew = $page.params.id === "new";
    const title = isNew ? "Create WhatsApp Account" : "Edit WhatsApp Account";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["WhatsApp", "/admin/whatsapp"],
        ["Accounts", "/admin/whatsapp/accounts"],
        isNew ? "New Account" : account?.name || "Edit Account",
    ];

    const { form, errors, enhance, submitting } = superForm(data.form, {
        onResult: async ({ result }) => {
            if (result.type === "success") {
                toast.success(
                    isNew
                        ? "WhatsApp account created"
                        : "WhatsApp account updated",
                );
                try {
                    await goto("/admin/whatsapp/accounts");
                } catch (error) {
                    console.error("Navigation error:", error);
                    toast.error("Failed to redirect. Please try again.");
                }
            }
        },
        onError: (err) => {
            toast.error(err.message);
        },
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader {title} />

    <PageContent>
        <!-- WhatsApp Account Info Card -->
        <FormCard
            {title}
            description={isNew
                ? "Create a new WhatsApp account"
                : "Edit details for this WhatsApp account"}
            loading={$submitting}
            footerSlot={!isNew && account}
        >
            <FormContainer {enhance} action="?/save">
                <!-- Two-column layout for shorter fields -->
                <FormRow columns={3}>
                    <!-- Phone Number -->
                    <FormField
                        id="phoneNumber"
                        label="Phone Number"
                        error={$errors.phoneNumber}
                    >
                        <Input
                            id="phoneNumber"
                            name="phoneNumber"
                            bind:value={$form.phoneNumber}
                            placeholder="e.g. +65 9123 4567"
                        />
                    </FormField>

                    <FormField
                        id="phoneNumber2"
                        label="Phone Number"
                        error={$errors.phoneNumber}
                    >
                        <Input
                            id="phoneNumber"
                            name="phoneNumber"
                            bind:value={$form.phoneNumber}
                            placeholder="e.g. +65 9123 4567"
                        />
                    </FormField>

                    <!-- Name -->
                    <FormField id="name" label="Name" error={$errors.name}>
                        <Input
                            id="name"
                            name="name"
                            bind:value={$form.name}
                            placeholder="e.g. John's WhatsApp"
                        />
                    </FormField>
                </FormRow>

                <!-- Description - Full width -->
                <FormField
                    id="description"
                    label="Description"
                    error={$errors.description}
                >
                    <Textarea
                        id="description"
                        name="description"
                        bind:value={$form.description}
                        placeholder="A brief description of this WhatsApp account"
                        class="min-h-[100px]"
                    />
                </FormField>

                <!-- Two-column layout for status and buttons -->
                <FormRow columns={2} alignItems="end">
                    <!-- Status -->
                    <FormField
                        id="status"
                        label="Status"
                        error={$errors.status}
                    >
                        <EnhancedSelect
                            value={$form.status}
                            name="status"
                            placeholder="Select status"
                            labelText="Status"
                            portal={null}
                            on:change={(e) => ($form.status = e.detail)}
                        >
                            <Select.Item value="active">Active</Select.Item>
                            <Select.Item value="inactive">Inactive</Select.Item>
                            <Select.Item value="pending">Pending</Select.Item>
                        </EnhancedSelect>
                    </FormField>

                    <!-- Submit Button -->
                </FormRow>
                <FormRow columns={1} alignItems="end">
                    <FormActions>
                        <Button
                            variant="outline"
                            type="button"
                            on:click={() => goto("/admin/whatsapp/accounts")}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Save Changes</Button>
                    </FormActions>
                </FormRow>
            </FormContainer>

            <svelte:fragment slot="footer">
                {#if !isNew && account}
                    <MetadataFooter
                        items={[
                            { label: "Created", date: account.createdAt },
                            { label: "Last Updated", date: account.updatedAt },
                        ]}
                    />
                {/if}
            </svelte:fragment>
        </FormCard>
    </PageContent>
</PageContainer>
