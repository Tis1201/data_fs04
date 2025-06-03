<script lang="ts">
    import { goto } from "$app/navigation";
    import { ArrowLeft, Save, Plus, Package } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
    import EnhancedTimePicker from "$lib/components/ui_components_sveltekit/form/EnhancedTimePicker.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create Bundle";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        "New Bundle"
    ];
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import { toast } from "svelte-sonner";
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/iot/bundles',
        validateOnInput: true,
        onSuccess: () => {
            // Toast is handled by the redirect
            toast.success("Bundle created successfully!");
        }
    });

    // OS options for the dropdown
    const osOptions = [
        { value: 'ANDROID', label: 'Android' },
        { value: 'IOS', label: 'iOS' }
    ];

    // Set default account ID from server data
    if (data.defaultAccountId && !$form.accountId) {
        $form.accountId = data.defaultAccountId;
    }
    
    // Default timezone is UTC
    $form.scheduledAtTimezone = 'UTC';
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/iot/bundles'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
    //   {
    //     label: "Save & New",
    //     icon: Plus,
    //     variant: "outline",
    //     class: "h-9",
    //     disabled: $submitting,
    //     onClick: async () => {
    //       const form = document.querySelector('form[action="?/create"]');
    //       if (form) {
    //         // Add a hidden field to indicate save and new
    //         const input = document.createElement('input');
    //         input.type = 'hidden';
    //         input.name = 'saveAndNew';
    //         input.value = 'true';
    //         form.appendChild(input);
    //         form.requestSubmit();
    //       }
    //     }
    //   },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9", // Fixed height for consistency
        disabled: $submitting
      }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <div class="w-full space-y-6">
        <FormContainer
            method="POST"
            action="?/create"
            {enhance}
            novalidate
            errorMessage={$errorMessage}
        >
            <AdminCard
                title="Bundle Information"
                description="Create a new bundle for software updates"
                icon={Package}
                compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={1}>
                        <FormField id="name" label="Bundle Name" error={$errors.name} required={true}>
                            <Input
                                id="name"
                                name="name"
                                type="text"
                                bind:value={$form.name}
                                placeholder="Enter bundle name"
                                aria-invalid={$errors.name ? 'true' : undefined}
                                {...$constraints.name}
                            />
                        </FormField>
                    </FormRow>

                    <FormRow columns={1}>
                        <FormField id="description" label="Description" error={$errors.description}>
                            <Textarea
                                id="description"
                                name="description"
                                bind:value={$form.description}
                                placeholder="Enter bundle description"
                                rows={3}
                                aria-invalid={$errors.description ? 'true' : undefined}
                                {...$constraints.description}
                            />
                        </FormField>
                    </FormRow>

                    <!-- Hidden fields for OS and accountId with default values -->
                    <input type="hidden" name="os" bind:value={$form.os} />
                    <input type="hidden" name="accountId" bind:value={$form.accountId} />

                    <FormRow columns={2}>
                        <FormField id="waveSize" label="Wave Size" error={$errors.waveSize} required={true}>
                            <Input
                                id="waveSize"
                                name="waveSize"
                                type="number"
                                bind:value={$form.waveSize}
                                placeholder="500"
                                min="1"
                                aria-invalid={$errors.waveSize ? 'true' : undefined}
                                {...$constraints.waveSize}
                            />
                        </FormField>

                        <FormField id="reboot" label="Reboot Device" error={$errors.reboot}>
                            <div class="flex items-center space-x-2">
                                <Switch
                                    id="reboot"
                                    name="reboot"
                                    checked={$form.reboot}
                                    onCheckedChange={(checked) => $form.reboot = checked}
                                />
                                <Label for="reboot">Reboot device after installation</Label>
                            </div>
                        </FormField>
                    </FormRow>

                    <FormRow columns={2}>
                        <FormField id="scheduledAt" label="Schedule Date" error={$errors.scheduledAt}>
                            <EnhancedDatePicker
                                id="scheduledAt"
                                name="scheduledAt"
                                form={$form}
                                field="scheduledAt"
                                placeholder="Select date"
                                format_string="yyyy-MM-dd"
                                clearable={true}
                            />
                        </FormField>
                        <FormField id="scheduledTime" label="Schedule Time" error={$errors.scheduledTime}>
                            <EnhancedTimePicker
                                id="scheduledTime"
                                name="scheduledTime"
                                form={$form}
                                field="scheduledTime"
                                placeholder="Select time"
                                clearable={true}
                            />
                        </FormField>
                        <!-- Hidden timezone field with default UTC value -->
                        <input type="hidden" name="scheduledAtTimezone" bind:value={$form.scheduledAtTimezone} />
                    </FormRow>

                    <FormRow columns={1}>
                        <FormField id="scheduledAtStartIfMissed" label="Start if Missed" error={$errors.scheduledAtStartIfMissed}>
                            <div class="flex items-center space-x-2">
                                <Checkbox
                                    id="scheduledAtStartIfMissed"
                                    name="scheduledAtStartIfMissed"
                                    checked={$form.scheduledAtStartIfMissed}
                                    onCheckedChange={(checked) => $form.scheduledAtStartIfMissed = !!checked}
                                    disabled={!$form.scheduledAt}
                                />
                                <Label for="scheduledAtStartIfMissed">
                                    Start immediately if scheduled time is missed
                                </Label>
                            </div>
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>
        </FormContainer>
    </div>
</AdminPageLayout>
