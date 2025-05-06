<script lang="ts">
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Save, X, ArrowLeft } from "lucide-svelte";
    import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import type { PageData } from "./$types";
    import { DEVICE_STATUSES, DEVICE_TYPES } from "../schema";

    export let data: PageData;
    const { device } = data;
    const title = `Edit ${device.name || "Device"}`;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Devices", "/admin/iot/devices"],
        [device.name || "Device", `/admin/iot/devices/${device.id}`],
        ["Edit", ""]
    ];

    // Setup the form
    const { form, errors, enhance, submitting } = superForm(data.form, {
        onUpdated: ({ form }) => {
            if (form.data.success) {
                toast.success(form.data.message || "Device updated successfully");
            }
        },
        resetForm: false,
        taintedMessage: null
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight">{title}</h1>
        </div>
        
        <!-- Form actions -->
        <div class="flex items-center space-x-2">
            <Button 
                type="submit" 
                form="device-edit-form"
                disabled={$submitting}
                variant="default"
            >
                <Save class="mr-2 h-4 w-4" />
                {$submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button 
                type="submit" 
                variant="outline" 
                form="cancel-form"
            >
                <X class="mr-2 h-4 w-4" />
                Cancel
            </Button>
        </div>
    </div>

    <PageContent>
        <div class="space-y-6">
            <!-- Device Info Card -->
            <FormCard
                title="Device Information"
                description="Edit basic details for this IoT device. Only name, status, and description can be modified."
                loading={$submitting}
            >
                <!-- Edit Form -->
                <FormContainer action="?/save" {enhance}>
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

                        <!-- Status -->
                        <FormField
                            id="status"
                            label="Status"
                            error={$errors.status}
                        >
                            <EnhancedSelect
                                id="status"
                                name="status"
                                options={DEVICE_STATUSES}
                                bind:value={$form.status}
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

                    <!-- Hidden ID field -->
                    <input type="hidden" name="id" bind:value={$form.id} />
                </FormContainer>

                <!-- Cancel form (separate form for the cancel action) -->
                <form id="cancel-form" action="?/cancel" method="POST"></form>
            </FormCard>
        </div>
    </PageContent>
</PageContainer>
