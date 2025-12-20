<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { zod } from "sveltekit-superforms/adapters";
    import {
        ArrowLeft,
        Save,
        Radio,
        AlertCircle,
        CheckCircle2,
        Wifi,
        WifiOff,
    } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { Badge } from "$lib/components/ui/badge";

    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";

    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";

    import type { PageData } from "./$types";

    export let data: PageData;
    const title = "Register Radar Controller";

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Controllers", "/admin/controllers"],
        ["Radar", "/admin/controllers/radar"],
        "Register",
    ];

    import {
        getDetailPageFormConfig,
        getFieldProps,
        processFormMessages,
        getSelectProps,
    } from "$lib/utils/formHelpers";
    import { radarSensorSchema } from "./radar-sensor";

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
                await goto("/admin/controllers/radar");
            }
        },
    });

    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;

    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
        { value: "MAINTENANCE", label: "Maintenance" },
    ];

    let selectedDevice: any = null;

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
            label: "Register",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/create"]');
                if (form) form.requestSubmit();
            },
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
            <AdminCard
                title="Select Device"
                description="Choose the device with the radar controller"
                icon={Radio}
                compact={true}
            >
                <div class="space-y-4">
                    <FormField
                        id="deviceId"
                        label="Device"
                        error={$errors.deviceId}
                        required={true}
                        helpText="Select the device that has the radar sensor hardware"
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
                            {...getSelectProps($errors, "deviceId", isLoading)}
                        />
                    </FormField>

                    {#if selectedDevice}
                        <div
                            class="rounded-lg border bg-muted/50 p-4 space-y-3"
                        >
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    {#if selectedDevice.connected}
                                        <Wifi class="h-4 w-4 text-green-600" />
                                        <span
                                            class="text-sm font-medium text-green-600"
                                            >Online</span
                                        >
                                    {:else}
                                        <WifiOff
                                            class="h-4 w-4 text-gray-400"
                                        />
                                        <span
                                            class="text-sm font-medium text-gray-400"
                                            >Offline</span
                                        >
                                    {/if}
                                </div>
                                <Badge variant="outline"
                                    >{selectedDevice.status}</Badge
                                >
                            </div>

                            <div class="text-sm text-muted-foreground">
                                <p>
                                    <span class="font-medium">Account:</span>
                                    {selectedDevice.account?.name || "N/A"}
                                </p>
                                {#if selectedDevice.hardwareId}
                                    <p>
                                        <span class="font-medium"
                                            >Hardware ID:</span
                                        >
                                        {selectedDevice.hardwareId}
                                    </p>
                                {/if}
                            </div>

                            <Alert>
                                <AlertCircle class="h-4 w-4" />
                                <AlertDescription>
                                    Make sure the radar controller app is
                                    installed and configured on this device
                                    before registration.
                                </AlertDescription>
                            </Alert>
                        </div>
                    {/if}
                </div>
            </AdminCard>

            {#if selectedDevice}
                <AdminCard
                    title="Controller Details"
                    description="Configure the radar controller settings"
                    compact={true}
                >
                    <div class="space-y-6">
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
                                    placeholder="e.g., Building A - Floor 1"
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
                                label="Description"
                                error={$errors.description}
                            >
                                <Textarea
                                    id="description"
                                    name="description"
                                    bind:value={$form.description}
                                    placeholder="Additional notes about this sensor"
                                    rows="2"
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
                    </div>
                </AdminCard>
            {/if}
        </FormContainer>
    </div>
</AdminPageLayout>
