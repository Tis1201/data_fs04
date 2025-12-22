<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { zod } from "sveltekit-superforms/adapters";
    import { toast } from "svelte-sonner";
    import {
        ArrowLeft,
        Save,
        Radio,
        CheckCircle2,
        Wifi,
        WifiOff,
        Info,
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
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";

    import type { PageData } from "./$types";
    import { radarSensorSchema } from "./radar-sensor";
    import {
        getDetailPageFormConfig,
        getFieldProps,
        getSelectProps,
        processFormMessages,
    } from "$lib/utils/formHelpers";

    export let data: PageData;
    const title = "Create Radar Controller";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Controllers", "/admin/controllers"],
        ["Radar", "/admin/controllers/radar"],
        "Create New",
    ];

    // Enhanced SuperForms setup - best practice approach
    const {
        form,
        errors,
        enhance,
        submitting,
        message,
        delayed,
        timeout,
        tainted,
    } = superForm(data.form, {
        validators: zod(radarSensorSchema),
        ...getDetailPageFormConfig("Radar Controller"),
        onResult: async ({ result }) => {
            if (result.type === "success" && result.data?.controllerId) {
                await goto(
                    `/admin/controllers/radar/${result.data.controllerId}`,
                );
            } else if (result.type === "failure") {
                // Handle server-side errors
                const errorData = result.data?.error;
                if (errorData) {
                    serverError = errorData;
                }
            }
        },
        onError: ({ result }) => {
            // Handle network errors
            toast.error(result.error.message || "Failed to submit form");
        },
    });

    // Reactive states - using formHelpers pattern
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;

    let selectedDevice: any = null;

    // Server error state
    let serverError = "";
    let showForceOption = false;

    // Form submission handler
    function triggerSubmit() {
        const formElement = document.querySelector(
            'form[action="?/create"]',
        ) as HTMLFormElement;
        if (formElement) formElement.requestSubmit();
    }

    // Clear server error when interacting with form
    $: if ($form.deviceId || $form.name || $form.serialNumber) {
        if (serverError) serverError = "";
    }

    $: if ($form.deviceId) {
        selectedDevice = data.devices.find((d) => d.id === $form.deviceId);
        if (selectedDevice) {
            if (selectedDevice.account) {
                $form.accountId = selectedDevice.accountId;
            }
            if (selectedDevice.hardwareId && !$form.serialNumber) {
                $form.serialNumber = selectedDevice.hardwareId;
            }
            if (selectedDevice.name && !$form.name) {
                $form.name = `${selectedDevice.name} - Radar`;
            }
        }
    } else {
        selectedDevice = null;
    }

    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
        { value: "MAINTENANCE", label: "Maintenance" },
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: async () => await goto("/admin/controllers/radar"),
            variant: "outline",
            class: "h-9",
        },
        {
            label: "Create Controller",
            icon: Save,
            onClick: triggerSubmit,
            class: "h-9",
        },
    ]}
    loading={isLoading}
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
            {errorMessage}
            showAlerts={true}
            disabled={isLoading}
            {hasTimeout}
            {isLoading}
            delayed={$delayed}
        >
            {#if serverError && serverError.includes("already has a radar controller")}
                <div
                    class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4"
                >
                    <div class="flex items-start gap-3">
                        <Info class="h-5 w-5 text-destructive mt-0.5" />
                        <div class="space-y-2 flex-1">
                            <p class="text-sm font-medium text-destructive">
                                {serverError}
                            </p>

                            <div class="text-xs text-muted-foreground">
                                <ul class="list-disc list-inside space-y-1">
                                    <li>Select a different device</li>
                                    <li>
                                        Check the <a
                                            href="/admin/controllers/radar"
                                            class="underline hover:text-primary"
                                            >controllers list</a
                                        > for existing records
                                    </li>
                                </ul>
                            </div>

                            <div class="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="text-xs h-7"
                                    on:click={() =>
                                        (showForceOption = !showForceOption)}
                                >
                                    {showForceOption
                                        ? "Hide Advanced Options"
                                        : "Show Advanced Options"}
                                </Button>
                            </div>

                            {#if showForceOption}
                                <div
                                    class="mt-2 bg-background p-3 rounded border border-destructive/20"
                                >
                                    <p class="text-xs font-semibold mb-2">
                                        Force Creation (Caution)
                                    </p>
                                    <p
                                        class="text-xs text-muted-foreground mb-3"
                                    >
                                        This will forcibly remove any existing
                                        controller/sensor data for this device
                                        and create a new one.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        class="w-full sm:w-auto"
                                        on:click={() => {
                                            const formSubmit = new FormData();
                                            formSubmit.append(
                                                "deviceId",
                                                $form.deviceId,
                                            );
                                            formSubmit.append(
                                                "name",
                                                $form.name,
                                            );
                                            formSubmit.append(
                                                "serialNumber",
                                                $form.serialNumber,
                                            );
                                            formSubmit.append(
                                                "status",
                                                $form.status,
                                            );
                                            formSubmit.append(
                                                "accountId",
                                                $form.accountId,
                                            );
                                            formSubmit.append("force", "true");
                                            if ($form.location)
                                                formSubmit.append(
                                                    "location",
                                                    $form.location,
                                                );
                                            if ($form.description)
                                                formSubmit.append(
                                                    "description",
                                                    $form.description,
                                                );
                                            if ($form.firmware)
                                                formSubmit.append(
                                                    "firmware",
                                                    $form.firmware,
                                                );

                                            fetch("?/forceCreate", {
                                                method: "POST",
                                                body: formSubmit,
                                            })
                                                .then(async (response) => {
                                                    // SvelteKit action responses are JSON with a specific structure
                                                    const actionResult =
                                                        await response.json();
                                                    // The actual data is in actionResult.data for success responses
                                                    // Format: { type: 'success', status: 200, data: { form, success, controllerId, message } }
                                                    const controllerId =
                                                        actionResult?.data
                                                            ?.controllerId;
                                                    if (controllerId) {
                                                        toast.success(
                                                            "Controller created successfully",
                                                        );
                                                        goto(
                                                            `/admin/controllers/radar/${controllerId}`,
                                                        );
                                                    } else if (
                                                        actionResult?.data
                                                            ?.success &&
                                                        actionResult?.data?.form
                                                    ) {
                                                        // Sometimes controllerId might be at a different level
                                                        toast.error(
                                                            "Controller created but redirect failed. Please check the controllers list.",
                                                        );
                                                        goto(
                                                            "/admin/controllers/radar",
                                                        );
                                                    } else {
                                                        const errorMsg =
                                                            actionResult?.data
                                                                ?.error ||
                                                            "Force creation failed.";
                                                        serverError = errorMsg;
                                                    }
                                                })
                                                .catch((err) => {
                                                    console.error(
                                                        "Force create error:",
                                                        err,
                                                    );
                                                    serverError =
                                                        "Network error during force creation.";
                                                });
                                        }}
                                    >
                                        Force Create Controller
                                    </Button>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}

            <AdminCard
                title="Controller Information"
                description="Configure the basic details for the new radar controller"
                icon={Radio}
                compact={true}
            >
                <div class="space-y-6">
                    <FormRow columns={1}>
                        <FormField
                            id="deviceId"
                            label="Linked Device"
                            error={$errors.deviceId}
                            required={true}
                        >
                            <EnhancedSelect
                                id="deviceId"
                                name="deviceId"
                                bind:value={$form.deviceId}
                                placeholder="Select a device..."
                                options={data.devices.map((device) => ({
                                    value: device.id,
                                    label: `${device.name}${device.hardwareId ? ` (${device.hardwareId})` : ""}`,
                                }))}
                            />
                        </FormField>
                    </FormRow>

                    {#if selectedDevice}
                        <FormRow columns={1}>
                            <FormField
                                id="device-info"
                                label="Device Information"
                                error={$errors.deviceId}
                            >
                                <div class="space-y-3">
                                    <div>
                                        <span class="text-muted-foreground"
                                            >Account:</span
                                        >
                                        <div class="font-medium">
                                            {selectedDevice.account?.name ||
                                                "N/A"}
                                        </div>
                                    </div>
                                    <div>
                                        <span class="text-muted-foreground"
                                            >Status:</span
                                        >
                                        <div class="font-medium">
                                            {selectedDevice.status}
                                        </div>
                                    </div>
                                </div>
                            </FormField>
                        </FormRow>
                    {/if}

                    {#if selectedDevice}
                        <FormRow columns={2}>
                            <FormField
                                id="name"
                                label="Controller Name"
                                error={$errors.name}
                                required={true}
                            >
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    bind:value={$form.name}
                                    placeholder="e.g., Main Entrance Radar"
                                    {...getFieldProps(
                                        $errors,
                                        "name",
                                        isLoading,
                                    )}
                                />
                            </FormField>

                            <FormField
                                id="serialNumber"
                                label="Serial Number"
                                error={$errors.serialNumber}
                                required={true}
                            >
                                <Input
                                    id="serialNumber"
                                    name="serialNumber"
                                    type="text"
                                    bind:value={$form.serialNumber}
                                    placeholder="Auto-filled from device"
                                    {...getFieldProps(
                                        $errors,
                                        "serialNumber",
                                        isLoading,
                                    )}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={2}>
                            <FormField
                                id="location"
                                label="Location"
                                error={$errors.location}
                            >
                                <Input
                                    id="location"
                                    name="location"
                                    type="text"
                                    bind:value={$form.location}
                                    placeholder="e.g., Building A - Main Entrance"
                                    {...getFieldProps(
                                        $errors,
                                        "location",
                                        isLoading,
                                    )}
                                />
                            </FormField>

                            <FormField
                                id="status"
                                label="Status"
                                error={$errors.status}
                                required={true}
                            >
                                <EnhancedSelect
                                    id="status"
                                    name="status"
                                    bind:value={$form.status}
                                    placeholder="Select status"
                                    options={statusOptions}
                                    {...getSelectProps(
                                        $errors,
                                        "status",
                                        isLoading,
                                    )}
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
                                    placeholder="Additional notes about this controller"
                                    rows="3"
                                    class="w-full {$errors.description
                                        ? 'border-destructive focus:border-destructive'
                                        : ''}"
                                    disabled={isLoading}
                                    aria-invalid={$errors.description
                                        ? true
                                        : undefined}
                                />
                            </FormField>
                        </FormRow>

                        <input
                            type="hidden"
                            name="accountId"
                            bind:value={$form.accountId}
                        />
                        <input
                            type="hidden"
                            name="firmware"
                            bind:value={$form.firmware}
                        />
                    {/if}
                </div>
            </AdminCard>
        </FormContainer>

        <!-- Debug Info (only in development) -->
        {#if import.meta.env.DEV}
            <div class="mt-8 p-4 bg-gray-100 rounded-lg text-xs">
                <div class="font-bold mb-2">Debug Info:</div>
                <div class="space-y-1">
                    <div><strong>Loading:</strong> {isLoading}</div>
                    <div><strong>Has Changes:</strong> {hasChanges}</div>
                    <div>
                        <strong>Selected Device:</strong>
                        {selectedDevice?.name || "None"}
                    </div>
                    <div>
                        <strong>Form Data:</strong>
                        {JSON.stringify($form, null, 2)}
                    </div>
                </div>
            </div>
        {/if}
    </div>
</AdminPageLayout>
