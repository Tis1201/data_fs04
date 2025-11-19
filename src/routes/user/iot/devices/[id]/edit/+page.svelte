<script lang="ts">
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Save, X, ArrowLeft } from "lucide-svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import UserCard from "$lib/components/user/layout/UserCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
    import type { PageData } from "./$types";
    import { DEVICE_STATUSES } from "../schema";

    export let data: PageData;
    const { device } = data;
    const title = `Edit ${device.name || "Device"}`;

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Home", "/user"],
        ["IOT", ""],
        ["Devices", "/user/iot/devices"],
        [device.name || "Device", `/user/iot/devices/${device.id}`],
        ["Edit", ""]
    ];

    // Setup the form with automatic redirect
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
        successRedirect: `/user/iot/devices/${device.id}`,
        validateOnInput: true,
        onSuccess: (result) => {
            return {
                type: 'success',
                text: result.data?.message || "Device updated successfully"
            };
        }
    });
</script>

<UserPageLayout
    title={title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Save Changes",
            icon: Save,
            onClick: () => document.querySelector('form[action="?/save"]')?.requestSubmit(),
            variant: "default"
        },
        {
            label: "Cancel",
            icon: X,
            onClick: () => goto(`/user/iot/devices/${device.id}`),
            variant: "outline"
        }
    ]}
>
    <div class="space-y-6">
        <!-- Device Info Card -->
        <UserCard
            title="Device Information"
            description="Edit basic details for this IoT device. Only name, status, and description can be modified."
            compact={true}
        >
            <!-- Edit Form -->
            <FormContainer action="?/save" {enhance} errorMessage={$errorMessage}>
                <!-- Editable fields -->
                <FormRow columns={2}>
                    <!-- Name -->
                    <FormField
                        id="name"
                        label="Device Name"
                        error={$errors.name}
                    >
                        <Input
                            id="name"
                            name="name"
                            placeholder="Enter device name"
                            bind:value={$form.name}
                        />
                    </FormField>
                    
                    <!-- Status (read-only) -->
                    <FormField
                        id="status-display"
                        label="Status"
                    >
                        <Input
                            id="status-display"
                            value={$form.status}
                            readonly
                            disabled
                        />
                    </FormField>
                </FormRow>

                <!-- Description -->
                <FormField
                    id="description"
                    label="Description"
                    error={$errors.description}
                >
                    <Textarea
                        id="description"
                        name="description"
                        placeholder="Enter device description"
                        bind:value={$form.description}
                        rows={3}
                    />
                </FormField>

                <!-- Hidden fields -->
                <input type="hidden" name="id" bind:value={$form.id} />
                <input type="hidden" name="status" bind:value={$form.status} />
            </FormContainer>
        </UserCard>
    </div>
</UserPageLayout>
