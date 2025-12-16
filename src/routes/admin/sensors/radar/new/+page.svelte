<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from 'sveltekit-superforms/client';
    import { zod } from 'sveltekit-superforms/adapters';
    import { ArrowLeft, Save, Radio } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Register Radar Sensor";

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Sensors", "/admin/sensors"],
        ["Radar", "/admin/sensors/radar"],
        "Register"
    ];
    
    import { getDetailPageFormConfig, getFieldProps, processFormMessages, getSelectProps } from '$lib/utils/formHelpers';
    import { radarSensorSchema } from './radar-sensor';
    
    const { form, errors, enhance, submitting, message, delayed, timeout, tainted } = 
        superForm(data.form, {
            validators: zod(radarSensorSchema),
            ...getDetailPageFormConfig("Radar Sensor"),
            onResult: async ({ result }) => {
                if (result.type === "success") {
                    await goto('/admin/sensors/radar');
                }
            }
        });
    
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    $: ({ errorMessage } = processFormMessages($message));
    $: hasChanges = $tainted;
    
    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
        { value: "MAINTENANCE", label: "Maintenance" }
    ];
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: async () => await goto('/admin/sensors/radar'),
        variant: "outline",
        class: "h-9"
      },
      {
        label: "Register",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9"
      }
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
            title="Sensor Information"
            description="Register a new radar sensor in the system"
            icon={Radio}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField 
                        id="name" 
                        label="Sensor Name" 
                        error={$errors.name}
                        required={true}
                        helpText="Enter a descriptive name for the sensor"
                    >
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="e.g., Main Entrance Radar"
                            {...getFieldProps($errors, 'name', isLoading)}
                        />
                    </FormField>
                    
                    <FormField 
                        id="serialNumber" 
                        label="Serial Number" 
                        error={$errors.serialNumber}
                        required={true}
                        helpText="Unique serial number from the device"
                    >
                        <Input
                            id="serialNumber"
                            name="serialNumber"
                            type="text"
                            bind:value={$form.serialNumber}
                            placeholder="e.g., RDR-2024-001"
                            {...getFieldProps($errors, 'serialNumber', isLoading)}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={2}>
                    <FormField 
                        id="accountId" 
                        label="Account" 
                        error={$errors.accountId}
                        required={true}
                        helpText="Select the account that owns this sensor"
                    >
                        <EnhancedSelect
                            id="accountId"
                            name="accountId"
                            bind:value={$form.accountId}
                            placeholder="Select an account"
                            options={data.accounts.map(account => ({
                                value: account.id,
                                label: account.name
                            }))}
                            {...getSelectProps($errors, 'accountId', isLoading)}
                        />
                    </FormField>
                    
                    <FormField 
                        id="status" 
                        label="Status" 
                        error={$errors.status}
                        required={true}
                        helpText="Current operational status"
                    >
                        <EnhancedSelect
                            id="status"
                            name="status"
                            bind:value={$form.status}
                            placeholder="Select status"
                            options={statusOptions}
                            {...getSelectProps($errors, 'status', isLoading)}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={2}>
                    <FormField 
                        id="location" 
                        label="Location" 
                        error={$errors.location}
                        helpText="Physical location of the sensor"
                    >
                        <Input
                            id="location"
                            name="location"
                            type="text"
                            bind:value={$form.location}
                            placeholder="e.g., Building A - Floor 1"
                            {...getFieldProps($errors, 'location', isLoading)}
                        />
                    </FormField>
                    
                    <FormField 
                        id="firmware" 
                        label="Firmware Version" 
                        error={$errors.firmware}
                        helpText="Current firmware version"
                    >
                        <Input
                            id="firmware"
                            name="firmware"
                            type="text"
                            bind:value={$form.firmware}
                            placeholder="e.g., v1.2.3"
                            {...getFieldProps($errors, 'firmware', isLoading)}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
        
        <AdminCard
            title="Device Linking"
            description="Optionally link this sensor to an existing device"
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField 
                        id="deviceId" 
                        label="Linked Device" 
                        error={$errors.deviceId}
                        helpText="Select a device to link with this sensor (optional)"
                    >
                        <EnhancedSelect
                            id="deviceId"
                            name="deviceId"
                            bind:value={$form.deviceId}
                            placeholder="Select a device (optional)"
                            options={[
                                { value: "", label: "No device linked" },
                                ...data.devices.map(device => ({
                                    value: device.id,
                                    label: `${device.name}${device.hardwareId ? ` (${device.hardwareId})` : ''}`
                                }))
                            ]}
                            {...getSelectProps($errors, 'deviceId', isLoading)}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField 
                        id="description" 
                        label="Description" 
                        error={$errors.description}
                        helpText="Additional notes about this sensor"
                    >
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Enter sensor description"
                            rows="3"
                            class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                            disabled={isLoading}
                            aria-invalid={$errors.description ? true : undefined}
                        />
                    </FormField>
                </FormRow>
            </div>
        </AdminCard>
    </FormContainer>
    </div>
</AdminPageLayout>
