<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { zod } from "sveltekit-superforms/adapters";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, Radio } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import {
        Card,
        CardHeader,
        CardTitle,
        CardContent,
    } from "$lib/components/ui/card";

    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
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
    const title = "Register Radar Controller";

    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Controllers", "/user/controllers"],
        ["Radar", "/user/controllers/radar"],
        "Register New",
    ];

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
            console.log("[CreateController] Form result:", result);

            if (result.type === "success") {
                // Access data from the result
                const resultData = (result as any).data;
                console.log("[CreateController] Success data:", resultData);

                if (resultData?.controllerId) {
                    toast.success("Controller created successfully!");
                    await goto(
                        `/user/controllers/radar/${resultData.controllerId}`,
                    );
                } else if (resultData?.error) {
                    // Server returned success but with an error message
                    serverError = resultData.error;
                    toast.error(resultData.error);
                }
            } else if (result.type === "failure") {
                const resultData = (result as any).data;
                const errorData = resultData?.error;
                console.log("[CreateController] Failure error:", errorData);
                if (errorData) {
                    serverError = errorData;
                    toast.error(errorData);
                } else {
                    toast.error(
                        "Failed to create controller. Please check the form.",
                    );
                }
            } else if (result.type === "error") {
                toast.error("An unexpected error occurred");
            }
        },
        onError: ({ result }) => {
            console.error("[CreateController] onError:", result);
            toast.error(result.error.message || "Failed to submit form");
        },
    });

    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;

    let selectedDevice: any = null;
    let serverError = "";

    function triggerSubmit() {
        const formElement = document.querySelector(
            'form[action="?/create"]',
        ) as HTMLFormElement;
        if (formElement) formElement.requestSubmit();
    }

    $: if ($form.deviceId || $form.name || $form.serialNumber) {
        if (serverError) serverError = "";
    }

    $: if ($form.deviceId) {
        selectedDevice = data.devices.find((d) => d.id === $form.deviceId);
        if (selectedDevice) {
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

<UserPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: async () => await goto("/user/controllers/radar"),
            variant: "outline",
        },
        {
            label: "Create Controller",
            icon: Save,
            onClick: triggerSubmit,
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
            {#if serverError}
                <div
                    class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4"
                >
                    <p class="text-sm font-medium text-destructive">
                        {serverError}
                    </p>
                </div>
            {/if}

            <Card>
                <CardHeader class="pb-2">
                    <CardTitle class="text-base flex items-center">
                        <Radio class="mr-2 h-4 w-4" />
                        Controller Information
                    </CardTitle>
                </CardHeader>
                <CardContent class="pt-0 px-4 pb-4">
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
                                    <div class="space-y-3 text-sm">
                                        <div>
                                            <span class="text-muted-foreground"
                                                >Status:</span
                                            >
                                            <span class="font-medium ml-2"
                                                >{selectedDevice.status}</span
                                            >
                                        </div>
                                    </div>
                                </FormField>
                            </FormRow>

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
                                name="firmware"
                                bind:value={$form.firmware}
                            />
                            <input
                                type="hidden"
                                name="deviceId"
                                bind:value={$form.deviceId}
                            />
                        {/if}
                    </div>
                </CardContent>
            </Card>
        </FormContainer>
    </div>
</UserPageLayout>
