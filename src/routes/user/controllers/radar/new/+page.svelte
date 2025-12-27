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

    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";

    import type { PageData } from "./$types";
    import { radarSensorSchema } from "../../../../admin/controllers/radar/new/radar-sensor";
    import {
        getDetailPageFormConfig,
        getFieldProps,
        getSelectProps,
        processFormMessages,
    } from "$lib/utils/formHelpers";

    export let data: PageData;
    const title = "Register Radar Controller";

    // Enhanced SuperForms setup
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
            if (result.type === "success") {
                toast.success("Radar Controller created successfully!");
                // Redirect will be handled by server action
            } else if (result.type === "failure") {
                const errorData = result.data?.error;
                if (errorData) {
                    serverError = errorData;
                    toast.error(errorData);
                } else {
                    const formErrors = result.data?.form?.errors;
                    if (formErrors) {
                        const errorMessages: string[] = [];
                        Object.entries(formErrors).forEach(([field, errors]) => {
                            if (Array.isArray(errors) && errors.length > 0) {
                                errorMessages.push(`${field}: ${errors[0]}`);
                            }
                        });
                        if (errorMessages.length > 0) {
                            serverError = errorMessages.join(", ");
                            toast.error(serverError);
                        }
                    }
                }
            }
        },
        onError: ({ result }) => {
            toast.error(result.error.message || "Failed to submit form");
        },
    });

    // Reactive states
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;

    interface DeviceWithAccount {
        id: string;
        name: string;
        hardwareId: string | null;
        accountId: string;
        account?: { id: string; name: string } | null;
    }
    
    let selectedDevice: DeviceWithAccount | null = null;

    // Server error state
    let serverError = "";

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

    // Auto-fill logic when device is selected
    $: if ($form.deviceId) {
        selectedDevice = data.devices.find((d: DeviceWithAccount) => d.id === $form.deviceId) || null;
        if (selectedDevice) {
            // Auto-assign to current account (security)
            $form.accountId = data.currentAccountId;
            
            // Auto-fill serial number
            if (!$form.serialNumber) {
                if (selectedDevice.hardwareId) {
                    $form.serialNumber = selectedDevice.hardwareId;
                } else if (selectedDevice.name) {
                    const nameMatch = selectedDevice.name.match(/\(([^)]+)\)|-\s*([A-F0-9:]+)$/i);
                    if (nameMatch) {
                        $form.serialNumber = nameMatch[1] || nameMatch[2] || selectedDevice.name;
                    } else {
                        $form.serialNumber = selectedDevice.name;
                    }
                } else {
                    $form.serialNumber = selectedDevice.id.substring(0, 20);
                }
            }
            
            // Auto-fill name
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

    // Device options for select
    $: deviceOptions = data.devices.map((device: DeviceWithAccount) => {
        const label = device.hardwareId 
            ? `${device.name} (${device.hardwareId})` 
            : device.name;
        return {
            value: device.id,
            label: label
        };
    });
</script>

<div class="container mx-auto py-6 space-y-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">{title}</h1>
            <p class="text-muted-foreground">
                Register a new radar controller for your account
            </p>
        </div>
        <Button
            variant="outline"
            on:click={() => goto("/user/controllers/radar")}
            class="flex items-center gap-2"
        >
            <ArrowLeft class="h-4 w-4" />
            Cancel
        </Button>
    </div>

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
            {#if serverError}
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
                                    <li>Use a unique serial number</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}

            <div class="grid gap-6">
                <FormRow columns={2}>
                    <FormField
                        id="device"
                        label="Device"
                        error={errors.deviceId}
                        required
                        {...getFieldProps("deviceId", $form, errors)}
                    >
                        <EnhancedSelect
                            name="deviceId"
                            options={deviceOptions}
                            bind:value={$form.deviceId}
                            placeholder="Select a device"
                            required={true}
                            {...getSelectProps("deviceId", $form, errors)}
                        />
                        {#if selectedDevice}
                            <p class="text-xs text-muted-foreground mt-1">
                                Device from your account will be used
                            </p>
                        {/if}
                    </FormField>

                    <FormField
                        id="status"
                        label="Status"
                        error={errors.status}
                        {...getFieldProps("status", $form, errors)}
                    >
                        <EnhancedSelect
                            name="status"
                            options={statusOptions}
                            bind:value={$form.status}
                            {...getSelectProps("status", $form, errors)}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField
                        id="name"
                        label="Sensor Name"
                        error={errors.name}
                        required
                        {...getFieldProps("name", $form, errors)}
                    >
                        <Input
                            name="name"
                            bind:value={$form.name}
                            placeholder="e.g., Main Hall Radar"
                            required
                        />
                    </FormField>

                    <FormField
                        id="serialNumber"
                        label="Serial Number"
                        error={errors.serialNumber}
                        required
                        {...getFieldProps("serialNumber", $form, errors)}
                    >
                        <Input
                            name="serialNumber"
                            bind:value={$form.serialNumber}
                            placeholder="e.g., RADAR-001"
                            required
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                            Must be unique across all controllers
                        </p>
                    </FormField>
                </FormRow>

                <FormRow columns={1}>
                    <FormField
                        id="description"
                        label="Description"
                        error={errors.description}
                        {...getFieldProps("description", $form, errors)}
                    >
                        <Textarea
                            name="description"
                            bind:value={$form.description}
                            placeholder="Optional description"
                            rows={3}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={2}>
                    <FormField
                        id="location"
                        label="Location"
                        error={errors.location}
                        {...getFieldProps("location", $form, errors)}
                    >
                        <Input
                            name="location"
                            bind:value={$form.location}
                            placeholder="e.g., Building A, Floor 2"
                        />
                    </FormField>

                    <FormField
                        id="firmware"
                        label="Firmware Version"
                        error={errors.firmware}
                        {...getFieldProps("firmware", $form, errors)}
                    >
                        <Input
                            name="firmware"
                            bind:value={$form.firmware}
                            placeholder="e.g., v1.0.0"
                        />
                    </FormField>
                </FormRow>

                <!-- Hidden accountId field (auto-assigned) -->
                <input type="hidden" name="accountId" bind:value={$form.accountId} />

                <div class="flex justify-end gap-3 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        on:click={() => goto("/user/controllers/radar")}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isLoading}
                        class="flex items-center gap-2"
                    >
                        {#if isLoading}
                            <span class="loading loading-spinner loading-sm"></span>
                        {:else}
                            <Save class="h-4 w-4" />
                        {/if}
                        Register Controller
                    </Button>
                </div>
            </div>
        </FormContainer>
    </div>
</div>

