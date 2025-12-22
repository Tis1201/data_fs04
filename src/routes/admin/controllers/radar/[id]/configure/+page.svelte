<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { zod } from "sveltekit-superforms/adapters";
    import {
        ArrowLeft,
        Save,
        CheckCircle2,
        Settings,
        MapPin,
        Grid3x3,
        Clock,
        ArrowRight,
    } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";

    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";

    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";

    import type { PageData } from "./$types";

    export let data: PageData;
    const title = "Configure Radar Sensor";

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Controllers", "/admin/controllers"],
        ["Radar", "/admin/controllers/radar"],
        [data.controller.name, `/admin/controllers/radar/${data.controller.id}`],
        ["Configure"],
    ];

    import {
        getDetailPageFormConfig,
        getFieldProps,
        processFormMessages,
    } from "$lib/utils/formHelpers";
    import { trackingAreaSchema } from "../tracking-area-schema";

    const {
        form,
        errors,
        enhance,
        submitting,
        message,
        delayed,
        timeout,
        tainted,
    } = superForm(data.trackingAreaForm, {
        validators: zod(trackingAreaSchema),
        ...getDetailPageFormConfig("Tracking Area"),
        onResult: async ({ result }) => {
            if (result.type === "success") {
                // Redirect to the controller detail page
                await goto(`/admin/controllers/radar/${data.controller.id}`);
            }
        },
    });

    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;

    // Set default values for tracking area
    $: if (!$form.name && data.controller.name) {
        $form.name = `${data.controller.name} Tracking Area`;
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Back to Controller",
            icon: ArrowLeft,
            onClick: async () => await goto(`/admin/controllers/radar/${data.controller.id}`),
            variant: "outline",
        },
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-6"
>
    <div class="max-w-2xl mx-auto">
        <!-- Wizard Header -->
        <div class="text-center mb-8">
            <div class="flex items-center justify-center mb-4">
                <div class="flex items-center">
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white font-medium text-sm">
                        <CheckCircle2 class="h-4 w-4" />
                    </div>
                    <div class="text-sm text-muted-foreground ml-3">Create Controller</div>
                    <div class="w-16 h-px bg-muted-foreground/30 mx-4"></div>
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-sm">2</div>
                    <div class="text-sm font-medium ml-3">Configure Sensor</div>
                </div>
            </div>
            <h2 class="text-lg font-semibold">Step 2: Configure Radar Sensor</h2>
            <p class="text-muted-foreground">Set up the tracking area for your radar sensor</p>
        </div>

        <!-- Controller Summary -->
        <AdminCard
            title="Controller Created"
            description="Your radar controller has been successfully created"
            compact={true}
        >
            <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                <div class="flex items-center gap-3">
                    <CheckCircle2 class="h-5 w-5 text-green-600" />
                    <div>
                        <div class="font-medium text-green-900">{data.controller.name}</div>
                        <div class="text-sm text-green-700">Serial: {data.controller.serialNumber}</div>
                    </div>
                </div>
                <Badge variant="default" class="bg-green-500">
                    {data.controller.status}
                </Badge>
            </div>
        </AdminCard>

        <!-- Sensor Configuration -->
        <FormContainer
            method="POST"
            action="?/createTrackingArea"
            {enhance}
            novalidate
            {errorMessage}
            showAlerts={true}
            disabled={isLoading}
            {hasTimeout}
            {isLoading}
            delayed={$delayed}
        >
            <div class="space-y-6">
                <AdminCard
                    title="Basic Tracking Area"
                    description="Define the primary area that the radar will monitor"
                    icon={MapPin}
                    compact={true}
                >
                    <div class="space-y-6">
                        <FormRow columns={1}>
                            <FormField
                                id="name"
                                label="Tracking Area Name"
                                error={$errors.name}
                                required={true}
                            >
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    bind:value={$form.name}
                                    placeholder="e.g., Main Entrance Area"
                                    {...getFieldProps($errors, "name", isLoading)}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={2}>
                            <FormField
                                id="startX"
                                label="Start X (meters)"
                                error={$errors.startX}
                                required={true}
                                helpText="Left boundary of the tracking area"
                            >
                                <Input
                                    id="startX"
                                    name="startX"
                                    type="number"
                                    step="0.1"
                                    bind:value={$form.startX}
                                    placeholder="-4.0"
                                    {...getFieldProps($errors, "startX", isLoading)}
                                />
                            </FormField>

                            <FormField
                                id="endX"
                                label="End X (meters)"
                                error={$errors.endX}
                                required={true}
                                helpText="Right boundary of the tracking area"
                            >
                                <Input
                                    id="endX"
                                    name="endX"
                                    type="number"
                                    step="0.1"
                                    bind:value={$form.endX}
                                    placeholder="4.0"
                                    {...getFieldProps($errors, "endX", isLoading)}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={2}>
                            <FormField
                                id="startY"
                                label="Start Y (meters)"
                                error={$errors.startY}
                                required={true}
                                helpText="Near boundary of the tracking area"
                            >
                                <Input
                                    id="startY"
                                    name="startY"
                                    type="number"
                                    step="0.1"
                                    bind:value={$form.startY}
                                    placeholder="0.0"
                                    {...getFieldProps($errors, "startY", isLoading)}
                                />
                            </FormField>

                            <FormField
                                id="endY"
                                label="End Y (meters)"
                                error={$errors.endY}
                                required={true}
                                helpText="Far boundary of the tracking area"
                            >
                                <Input
                                    id="endY"
                                    name="endY"
                                    type="number"
                                    step="0.1"
                                    bind:value={$form.endY}
                                    placeholder="4.0"
                                    {...getFieldProps($errors, "endY", isLoading)}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={1}>
                            <FormField
                                id="description"
                                label="Description (Optional)"
                                error={$errors.description}
                            >
                                <Textarea
                                    id="description"
                                    name="description"
                                    bind:value={$form.description}
                                    placeholder="Additional notes about this tracking area"
                                    rows="2"
                                    class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                                    disabled={isLoading}
                                    aria-invalid={$errors.description ? true : undefined}
                                />
                            </FormField>
                        </FormRow>
                    </div>
                </AdminCard>

                <!-- What's Next -->
                <AdminCard
                    title="What's Next?"
                    description="After creating the tracking area"
                    compact={true}
                >
                    <div class="space-y-3 text-sm">
                        <div class="flex items-start gap-3">
                            <Grid3x3 class="h-4 w-4 text-primary mt-0.5" />
                            <div>
                                <div class="font-medium">Detection Zones</div>
                                <div class="text-muted-foreground">Define specific areas within the tracking area for targeted monitoring</div>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <Clock class="h-4 w-4 text-primary mt-0.5" />
                            <div>
                                <div class="font-medium">Dwell Analysis</div>
                                <div class="text-muted-foreground">Set up time-based analysis for object presence duration</div>
                            </div>
                        </div>
                        <div class="flex items-start gap-3">
                            <Settings class="h-4 w-4 text-primary mt-0.5" />
                            <div>
                                <div class="font-medium">Fine-tune Settings</div>
                                <div class="text-muted-foreground">Adjust sensitivity and detection parameters</div>
                            </div>
                        </div>
                    </div>
                </AdminCard>

                <!-- Action Buttons -->
                <div class="flex justify-between pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        on:click={() => goto(`/admin/controllers/radar/${data.controller.id}`)}
                    >
                        Skip for Now
                    </Button>
                    <Button type="submit" disabled={isLoading} class="min-w-[140px]">
                        {#if isLoading}
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating...
                        {:else}
                            Create & Finish
                            <ArrowRight class="h-4 w-4 ml-2" />
                        {/if}
                    </Button>
                </div>
            </div>
        </FormContainer>
    </div>
</AdminPageLayout>
