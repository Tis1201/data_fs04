<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { zod } from "sveltekit-superforms/adapters";
    import {
        ArrowLeft,
        Save,
        Radio,
        CheckCircle2,
        Wifi,
        WifiOff,
        ArrowRight,
    } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";

    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";

    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";

    import type { PageData } from "./$types";

    export let data: PageData;
    const title = "Create Radar Controller";

    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Controllers", "/admin/controllers"],
        ["Radar", "/admin/controllers/radar"],
        ["Create New"],
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
            if (result.type === "success" && result.data?.controllerId) {
                // Redirect to sensor configuration step
                await goto(`/admin/controllers/radar/${result.data.controllerId}/configure`);
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

    // Prepare form data based on current store values
    $: formData = {
        deviceId: $form.deviceId || '',
        name: $form.name || '',
        serialNumber: $form.serialNumber || '',
        status: $form.status || '',
        accountId: $form.accountId || '',
        location: $form.location || '',
        description: $form.description || '',
        firmware: $form.firmware || ''
    };
    
    // Server error state
    let serverError = '';
    let showForceOption = false;
    
    // Form validation reactive values
    $: isValid = !!formData.deviceId && !!formData.name && !!formData.serialNumber && !!formData.status;
    $: validationErrors = {
        deviceId: !formData.deviceId ? 'Device ID is required' : '',
        name: !formData.name ? 'Name is required' : '',
        serialNumber: !formData.serialNumber ? 'Serial number is required' : '',
        status: !formData.status ? 'Status is required' : ''
    };
    
    // Form submission handler that doesn't access stores directly
    async function handleSubmit() {
        console.log('handleSubmit called');
        console.log('Form data:', formData);
        
        // Check validation
        if (!isValid) {
            console.error('Validation failed:', validationErrors);
            return;
        }

        console.log('All validation passed, submitting...');
        
        // Create form data for submission
        const formDataForSubmit = new FormData();
        formDataForSubmit.append('deviceId', formData.deviceId);
        formDataForSubmit.append('name', formData.name);
        formDataForSubmit.append('serialNumber', formData.serialNumber);
        formDataForSubmit.append('status', formData.status);
        formDataForSubmit.append('accountId', formData.accountId);
        if (formData.location) formDataForSubmit.append('location', formData.location);
        if (formData.description) formDataForSubmit.append('description', formData.description);
        if (formData.firmware) formDataForSubmit.append('firmware', formData.firmware);

        try {
            const response = await fetch('?/create', {
                method: 'POST',
                body: formDataForSubmit
            });

            const result = await response.json();
            console.log('Full Response:', result);
            console.log('Response type:', result.type);
            console.log('Response data:', result.data);
            console.log('Controller ID:', result.data?.controllerId);

            if (result.type === 'success') {
                if (result.data?.controllerId) {
                    console.log('Navigating to configure page with ID:', result.data.controllerId);
                    await goto(`/admin/controllers/radar/${result.data.controllerId}/configure`);
                } else if (result.controllerId) {
                    console.log('Navigating to configure page with direct ID:', result.controllerId);
                    await goto(`/admin/controllers/radar/${result.controllerId}/configure`);
                } else {
                    console.error('Success response but no controller ID found');
                    console.log('Full result object:', JSON.stringify(result, null, 2));
                }
            } else if (result.type === 'failure') {
                console.error('Form submission failed:', result.data);
            }
            if (result.type === 'failure') {
                // Handle error message - try to extract it from the data
                try {
                    const errorData = JSON.parse(result.data);
                    // The last element in the array is the error message
                    if (Array.isArray(errorData) && errorData.length > 0) {
                        serverError = errorData[errorData.length - 1];
                    } else {
                        serverError = 'Failed to create controller. Please try again.';
                    }
                } catch (parseError) {
                    serverError = 'Failed to create controller. Please try again.';
                }
            }
        } catch (error) {
            console.error('Submission error:', error);
            serverError = 'An unexpected error occurred. Please try again.';
        }
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
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-sm">1</div>
                    <div class="text-sm font-medium ml-3">Create Controller</div>
                    <div class="w-16 h-px bg-muted-foreground/30 mx-4"></div>
                    <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground font-medium text-sm">2</div>
                    <div class="text-sm text-muted-foreground ml-3">Configure Sensor</div>
                </div>
            </div>
            <h2 class="text-lg font-semibold">Step 1: Create Radar Controller</h2>
            <p class="text-muted-foreground">Set up the basic controller information and device connection</p>
        </div>

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
            <div class="space-y-6">
                {#if serverError}
                    <div class="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-md mb-4">
                        <div class="flex items-start">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                            </svg>
                            <div>
                                <h4 class="font-semibold text-sm">Error</h4>
                                <p class="text-sm">{serverError}</p>
                                
                                {#if serverError.includes('already has a radar controller')}
                                    <div class="mt-2 pt-2 border-t border-destructive/30">
                                        <p class="text-xs font-medium">Suggestions:</p>
                                        <ul class="text-xs mt-1 list-disc list-inside">
                                            <li>Select a different device that doesn't have a radar controller</li>
                                            <li>Go to the <a href="/admin/controllers/radar" class="underline hover:text-destructive/70">controllers list</a> to find existing controllers</li>
                                        </ul>
                                        <div class="mt-2">
                                            <button 
                                                type="button"
                                                class="text-xs underline text-destructive hover:text-destructive/70"
                                                on:click={() => showForceOption = !showForceOption}
                                            >
                                                {showForceOption ? 'Hide advanced options' : 'Show advanced options'}
                                            </button>
                                        </div>
                                        
                                        {#if showForceOption}
                                            <div class="mt-2 bg-destructive/5 p-2 rounded">
                                                <p class="text-xs font-medium mb-2">Force option (use with caution):</p>
                                                <p class="text-xs mb-2">If this controller was previously deleted but still shows as existing, you can attempt to force creation.</p>
                                                <button
                                                    type="button"
                                                    class="text-xs px-2 py-1 bg-destructive text-white rounded hover:bg-destructive/80 w-full text-center"
                                                    on:click={() => {
                                                        // Use existing form data values
                                                        const formSubmit = new FormData();
                                                        formSubmit.append('deviceId', $form.deviceId);
                                                        formSubmit.append('name', $form.name);
                                                        formSubmit.append('serialNumber', $form.serialNumber);
                                                        formSubmit.append('status', $form.status);
                                                        formSubmit.append('accountId', $form.accountId);
                                                        formSubmit.append('force', 'true'); // Add force parameter
                                                        if ($form.location) formSubmit.append('location', $form.location);
                                                        if ($form.description) formSubmit.append('description', $form.description);
                                                        if ($form.firmware) formSubmit.append('firmware', $form.firmware);
                                                        
                                                        fetch('?/forceCreate', {
                                                            method: 'POST',
                                                            body: formSubmit
                                                        }).then(async response => {
                                                            const result = await response.json();
                                                            if (result.type === 'success' && result.data?.controllerId) {
                                                                goto(`/admin/controllers/radar/${result.data.controllerId}/configure`);
                                                            } else {
                                                                serverError = 'Force creation failed. Please contact system administrator.';
                                                            }
                                                        }).catch(error => {
                                                            console.error('Force creation error:', error);
                                                            serverError = 'Force creation failed. Please contact system administrator.';
                                                        });
                                                    }}
                                                >
                                                    Force Create Controller
                                                </button>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/if}
                
                <!-- Device Selection -->
                <AdminCard
                    title="Select Device"
                    description="Choose the device that will host the radar controller"
                    icon={Radio}
                    compact={true}
                >
                    <div class="space-y-4">
                        <FormField
                            id="deviceId"
                            label="Device"
                            error={$errors.deviceId}
                            required={true}
                            helpText="Select a device with radar hardware capabilities"
                        >
                            <EnhancedSelect
                                id="deviceId"
                                name="deviceId"
                                bind:value={$form.deviceId}
                                placeholder="Choose a device..."
                                options={data.devices.map((device) => ({
                                    value: device.id,
                                    label: `${device.name}${device.hardwareId ? ` (${device.hardwareId})` : ""}`,
                                }))}
                                {...getSelectProps($errors, "deviceId", isLoading)}
                            />
                        </FormField>

                        {#if selectedDevice}
                            <div class="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                                <div class="flex items-center justify-between mb-3">
                                    <div class="flex items-center gap-3">
                                        <CheckCircle2 class="h-5 w-5 text-green-600" />
                                        <div>
                                            <div class="font-medium">{selectedDevice.name}</div>
                                            <div class="text-sm text-muted-foreground">
                                                {selectedDevice.hardwareId || 'No hardware ID'}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        {#if selectedDevice.connected}
                                            <Badge variant="default" class="bg-green-500">
                                                <Wifi class="h-3 w-3 mr-1" />
                                                Online
                                            </Badge>
                                        {:else}
                                            <Badge variant="secondary">
                                                <WifiOff class="h-3 w-3 mr-1" />
                                                Offline
                                            </Badge>
                                        {/if}
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span class="text-muted-foreground">Account:</span>
                                        <div class="font-medium">{selectedDevice.account?.name || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <span class="text-muted-foreground">Status:</span>
                                        <div class="font-medium">{selectedDevice.status}</div>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                </AdminCard>

                <!-- Controller Configuration -->
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
                                        {...getFieldProps($errors, "name", isLoading)}
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
                                        {...getFieldProps($errors, "serialNumber", isLoading)}
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
                                        {...getFieldProps($errors, "location", isLoading)}
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
                                        {...getSelectProps($errors, "status", isLoading)}
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
                                        class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                                        disabled={isLoading}
                                        aria-invalid={$errors.description ? true : undefined}
                                    />
                                </FormField>
                            </FormRow>

                            <input type="hidden" name="accountId" bind:value={$form.accountId} />
                            <input type="hidden" name="firmware" bind:value={$form.firmware} />
                        </div>
                    </AdminCard>

                    <!-- Submit Button -->
                    <div class="flex justify-end pt-4">
                        <Button 
                            type="button" 
                            disabled={isLoading || !isValid} 
                            class="min-w-[140px]"
                            on:click={handleSubmit}
                        >
                            {#if isLoading}
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Creating...
                            {:else}
                                Create & Continue
                                <ArrowRight class="h-4 w-4 ml-2" />
                            {/if}
                        </Button>
                    </div>
                {/if}
            </div>
        </FormContainer>
        
        <!-- Debug Info (only in development) -->
        {#if import.meta.env.DEV}
            <div class="mt-8 p-4 bg-gray-100 rounded-lg text-xs">
                <h3 class="font-bold mb-2">Debug Info:</h3>
                <div class="space-y-1">
                    <div><strong>Form Valid:</strong> {isValid}</div>
                    <div><strong>Validation Errors:</strong> {JSON.stringify(validationErrors)}</div>
                    <div><strong>Loading:</strong> {isLoading}</div>
                    <div><strong>Has Changes:</strong> {hasChanges}</div>
                    <div><strong>Selected Device:</strong> {selectedDevice?.name || 'None'}</div>
                    <div><strong>Form Data:</strong> {JSON.stringify(formData, null, 2)}</div>
                </div>
            </div>
        {/if}
    </div>
</AdminPageLayout>
