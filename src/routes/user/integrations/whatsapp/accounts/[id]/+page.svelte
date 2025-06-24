<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { ArrowLeft, Save } from "lucide-svelte";
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
    
    // Layout Components
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    
    // UI Components
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Select from "$lib/components/ui/select/index.js";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import Card from "$lib/components/ui/card/card.svelte";
    import CardHeader from "$lib/components/ui/card/card-header.svelte";
    import CardTitle from "$lib/components/ui/card/card-title.svelte";
    import CardDescription from "$lib/components/ui/card/card-description.svelte";
    import CardContent from "$lib/components/ui/card/card-content.svelte";
    import CardFooter from "$lib/components/ui/card/card-footer.svelte";
    
    // Form Components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import ReadOnlyField from "$lib/components/ui_components_sveltekit/form/ReadOnlyField.svelte";
    import MetadataFooter from "$lib/components/ui_components_sveltekit/metadata/MetadataFooter.svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    
    import type { PageData } from "./$types";

    export let data: PageData;
    const { account } = data;
    const isNew = $page.params.id === "new";
    const title = isNew ? "Create WhatsApp Account" : `Edit: ${account?.name || 'WhatsApp Account'}`;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["User", "/user"],
        ["Integrations", "/user/integrations"],
        ["WhatsApp", "/user/integrations/whatsapp"],
        ["Accounts", "/user/integrations/whatsapp/accounts"],
        isNew ? "New Account" : account?.name || "Edit Account"
    ];

    // Create form handler using the project's standardized utility
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
        successRedirect: "/user/integrations/whatsapp/accounts",
        validateOnInput: true,
        onSuccess: (result) => {
            return {
                type: 'success',
                text: result.data?.message || (isNew ? "WhatsApp account created" : "WhatsApp account updated")
            };
        }
    });
</script>

<UserPageLayout 
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Back",
            icon: ArrowLeft,
            onClick: () => goto('/user/integrations/whatsapp/accounts'),
            variant: "outline"
        },
        {
            label: $submitting ? 'Saving...' : 'Save Changes',
            icon: Save,
            onClick: () => document.querySelector('form[action="?/save"]')?.requestSubmit(),
            variant: "default",
            disabled: $submitting
        }
    ]}
>
    <div class="w-full">
        <Card class="w-full">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>
                    {isNew
                        ? "Create a new WhatsApp account"
                        : "Edit details for this WhatsApp account"}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FormContainer {enhance} action="?/save" errorMessage={$errorMessage}>
                    <!-- Two-column layout for shorter fields -->
                    <FormRow columns={2}>
                        <!-- Phone Number (Read-only) -->
                        <FormField
                            label="Phone Number"
                            description="The phone number for this WhatsApp account"
                            required={true}
                        >
                            <div class="bg-muted/40 border border-muted rounded-md px-3 py-2 text-sm">
                                {$form.phoneNumber || 'Not specified'}
                            </div>
                        </FormField>

                        <!-- Name -->
                        <FormField 
                            id="name" 
                            label="Name" 
                            error={$errors.name}
                            required={true}
                        >
                            <Input
                                id="name"
                                name="name"
                                bind:value={$form.name}
                                placeholder="e.g. John's WhatsApp"
                                disabled={$submitting}
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
                            disabled={$submitting}
                        />
                    </FormField>

                    <!-- Two-column layout for status and buttons -->
                    <FormRow columns={2} alignItems="end">
                        <!-- Status (Read-only) -->
                        <FormField
                            label="Status"
                            description="Current status of the WhatsApp account"
                            required={true}
                        >
                            <div class="bg-muted/40 border border-muted rounded-md px-3 py-2 text-sm">
                                {$form.status === 'active' ? 'Active' : $form.status === 'inactive' ? 'Inactive' : 'Pending'}
                            </div>
                        </FormField>
                    </FormRow>
                    
                    <!-- Form actions are now in the page header -->
                </FormContainer>
            </CardContent>
            
            {#if !isNew && account}
                <CardFooter>
                        <MetadataFooter
                            items={[
                                { label: "Created", date: account.createdAt, icon: 'calendar' },
                                { label: "Last Updated", date: account.updatedAt, icon: 'clock' },
                                { label: "Created By", value: account.user?.name || 'Unknown', icon: 'user' },
                                // { label: "ID", value: account.id.substring(0, 8) + '...', icon: 'tag' }
                            ]}
                        />
                </CardFooter>
            {/if}
        </Card>
    </div>
</UserPageLayout>
