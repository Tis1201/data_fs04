<script lang="ts">
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Save, X, ArrowLeft } from "lucide-svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import { AdminCard } from "$lib/components/admin";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
    import type { PageData } from "./$types";
    import { DEVICE_STATUSES } from "../schema";

    export let data: PageData;
    const { device } = data;
    const title = `Edit ${device.name || "Device"}`;

    // Define breadcrumbs for this page
    const pageCrumbs: [string, string][] = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Devices", "/admin/iot/devices"],
        [device.name || "Device", `/admin/iot/devices/${device.id}`],
        ["Edit", ""]
    ];

    // Setup the form with automatic redirect
    const { form, errors, enhance, submitting, errorMessage } = createFormHandler(data.form, {
        successRedirect: `/admin/iot/devices/${device.id}`,
        validateOnInput: true,
        onSuccess: (result) => {
            return {
                type: 'success',
                text: result.data?.message || "Device updated successfully"
            };
        }
    });

</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title={title}>
        <div slot="action" class="flex items-center space-x-2">
            <Button 
                type="submit" 
                form="device-edit-form"
                disabled={$submitting}
                variant="default"
                class="flex items-center"
            >
                <Save class="mr-2 h-4 w-4" />
                {$submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            
            <Button 
                variant="outline"
                on:click={() => goto(`/admin/iot/devices/${device.id}`)}
                class="flex items-center"
            >
                <X class="mr-2 h-4 w-4" />
                Cancel
            </Button>
        </div>
    </PageHeader>
    
    <PageContent>
    <div class="space-y-6">
        <!-- Device Info Card -->
        <AdminCard
            title="Device Information"
            description="Edit basic details for this IoT device. Only name, status, and description can be modified."
            compact={true}
        >
            <!-- Edit Form -->
            <FormContainer id="device-edit-form" action="?/save" {enhance} errorMessage={$errorMessage}>
                <!-- Editable fields -->
                <FormRow columns={1}>
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

                <!-- Only name, status, and description are editable -->

                <!-- Hidden fields -->
                <input type="hidden" name="id" bind:value={$form.id} />
            </FormContainer>
        </AdminCard>
    </div>
    </PageContent>
</PageContainer>
