<script lang="ts">
    import { goto } from "$app/navigation";
    import { ArrowLeft, Save, Plus, Package, CheckCircle, ExternalLink, List } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    
    // Import the correct AdminPageLayout component with actionButtons support
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import form components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
    import EnhancedTimePicker from "$lib/components/ui_components_sveltekit/form/EnhancedTimePicker.svelte";
    
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create Bundle";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        "New Bundle"
    ];
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import { toast } from "svelte-sonner";
    
    // Track success state and created bundle
    let showSuccess = false;
    let createdBundle: any = null;
    
    // Function to extract bundle data from the response
    function extractBundleData(result: any): any {
        console.log('Extracting bundle data from:', JSON.stringify(result));
        
        // Direct access to the correct path based on the console logs
        if (result?.data?.form?.message?.data) {
            console.log('Found bundle data at result.data.form.message.data');
            return result.data.form.message.data;
        }
        
        // Try different paths to find the bundle data as fallbacks
        const paths = [
            // Path from the form message
            () => result?.form?.message?.data,
            // Direct data path
            () => result?.data?.data,
            // Message data path
            () => result?.message?.data,
            // Direct form data for fallback
            () => ({
                id: $form.id || 'N/A',
                name: $form.name || 'N/A',
                os: $form.os || 'N/A',
                version: $form.version || '1.0.0'
            })
        ];
        
        // Try each path until we find data
        for (const getPath of paths) {
            try {
                const data = getPath();
                if (data) {
                    console.log('Found bundle data at alternate path');
                    return data;
                }
            } catch (e) {
                // Ignore errors and try next path
            }
        }
        
        console.log('No bundle data found in any expected location');
        return null;
    }
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        // No redirect, we'll handle it manually
        validateOnInput: true,
        onSuccess: (result) => {
            // Show success view instead of redirecting
            console.log('Form success result:', JSON.stringify(result));
            
            // Extract bundle data using our helper function
            const bundleData = extractBundleData(result);
            console.log('Extracted bundle data:', bundleData);
            
            // Always show success view
            showSuccess = true;
            
            // Use extracted data or form data as fallback
            if (bundleData) {
                createdBundle = bundleData;
            } else {
                // Use form data as fallback
                createdBundle = {
                    id: $form.id || 'N/A',
                    name: $form.name || 'N/A',
                    os: $form.os || 'N/A',
                    version: $form.version || '1.0.0'
                };
                console.warn('Using form data as fallback:', createdBundle);
            }
            
            toast.success("Bundle created successfully!");
        }
    });

    // OS options for the dropdown
    const osOptions = [
        { value: 'ANDROID', label: 'Android' },
        { value: 'IOS', label: 'iOS' }
    ];

    // Set default account ID from server data
    if (data.defaultAccountId && !$form.accountId) {
        $form.accountId = data.defaultAccountId;
    }
    
    // Default timezone is UTC
    $form.scheduledAtTimezone = 'UTC';
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Cancel",
        icon: ArrowLeft,
        onClick: () => goto('/admin/iot/bundles'),
        variant: "outline",
        class: "h-9" // Fixed height for consistency
      },
    //   {
    //     label: "Save & New",
    //     icon: Plus,
    //     variant: "outline",
    //     class: "h-9",
    //     disabled: $submitting,
    //     onClick: async () => {
    //       const form = document.querySelector('form[action="?/create"]');
    //       if (form) {
    //         // Add a hidden field to indicate save and new
    //         const input = document.createElement('input');
    //         input.type = 'hidden';
    //         input.name = 'saveAndNew';
    //         input.value = 'true';
    //         form.appendChild(input);
    //         form.requestSubmit();
    //       }
    //     }
    //   },
      {
        label: "Save",
        icon: Save,
        onClick: () => {
          const form = document.querySelector('form[action="?/create"]');
          if (form) form.requestSubmit();
        },
        class: "h-9", // Fixed height for consistency
        disabled: $submitting
      }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    {#if showSuccess}
        <!-- Success View -->
        <Card class="border-0 shadow-md">
            <CardHeader class="pb-4 border-b">
                <CardTitle class="text-xl">Bundle Created Successfully</CardTitle>
                <CardDescription>Your bundle has been created and is ready for configuration.</CardDescription>
            </CardHeader>
            <CardContent class="pt-6">
                <div class="space-y-6">
                    <div class="mb-4 p-3 rounded-md w-full flex items-center gap-2 bg-green-100 text-green-800">
                        <CheckCircle class="h-5 w-5" />
                        <div>
                            <p class="text-sm font-medium">Bundle Created Successfully</p>
                            <p class="text-xs">Your bundle has been created and is ready for the next steps.</p>
                        </div>
                    </div>
                    
                    <div class="bg-muted/40 p-4 rounded-lg border border-muted">
                        <h4 class="text-sm font-medium mb-2">Bundle Details</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">Bundle ID</p>
                                <p class="text-sm font-mono break-all">{createdBundle?.id || 'N/A'}</p>
                            </div>

                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">Name</p>
                                <p class="text-sm">{createdBundle?.name || 'N/A'}</p>
                            </div>

                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">OS</p>
                                <p class="text-sm">{createdBundle?.os || 'N/A'}</p>
                            </div>

                            <div class="space-y-1">
                                <p class="text-xs text-muted-foreground">Version</p>
                                <p class="text-sm">{createdBundle?.version || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                            variant="default"
                            on:click={() => goto(`/admin/iot/bundles/${createdBundle?.id || ''}`)}
                            class="w-full sm:w-auto"
                        >
                            <ExternalLink class="mr-2 h-4 w-4" />
                            View Bundle Details
                        </Button>
                        
                        <Button
                            variant="outline"
                            on:click={() => goto('/admin/iot/bundles')}
                            class="w-full sm:w-auto"
                        >
                            <List class="mr-2 h-4 w-4" />
                            Back to Bundles
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    {:else}
        <div class="w-full space-y-6">
            <FormContainer
                method="POST"
                action="?/create"
                {enhance}
                novalidate
                errorMessage={$errorMessage}
                disabled={$submitting}
            >
                <AdminCard
                    title="Bundle Information"
                    description="Create a new bundle for software updates"
                    icon={Package}
                    compact={true}
                >
                    <div class="space-y-6">
                        <FormRow columns={1}>
                            <FormField id="name" label="Bundle Name" error={$errors.name} required={true}>
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    bind:value={$form.name}
                                    placeholder="Enter bundle name"
                                    aria-invalid={$errors.name ? 'true' : undefined}
                                    {...$constraints.name}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={1}>
                            <FormField id="description" label="Description" error={$errors.description}>
                                <Textarea
                                    id="description"
                                    name="description"
                                    bind:value={$form.description}
                                    placeholder="Enter bundle description"
                                    rows={3}
                                    aria-invalid={$errors.description ? 'true' : undefined}
                                    {...$constraints.description}
                                />
                            </FormField>
                        </FormRow>

                    <!-- Hidden fields for OS and accountId with default values -->
                    <input type="hidden" name="os" bind:value={$form.os} />
                    <input type="hidden" name="version" bind:value={$form.version} />
                    <input type="hidden" name="accountId" bind:value={$form.accountId} />

                    <FormRow columns={2}>
                        <FormField id="waveSize" label="Wave Size" error={$errors.waveSize} required={true}>
                            <Input
                                id="waveSize"
                                name="waveSize"
                                type="number"
                                bind:value={$form.waveSize}
                                placeholder="500"
                                min="1"
                                aria-invalid={$errors.waveSize ? 'true' : undefined}
                                {...$constraints.waveSize}
                            />
                        </FormField>

                        <FormField id="reboot" label="Reboot Device" error={$errors.reboot}>
                            <div class="flex items-center space-x-2">
                                <Switch
                                    id="reboot"
                                    name="reboot"
                                    checked={$form.reboot}
                                    onCheckedChange={(checked) => $form.reboot = checked}
                                />
                                <Label for="reboot">Reboot device after installation</Label>
                            </div>
                        </FormField>
                    </FormRow>

                    <FormRow columns={2}>
                        <FormField id="scheduledAt" label="Schedule Date" error={$errors.scheduledAt}>
                            <EnhancedDatePicker
                                id="scheduledAt"
                                name="scheduledAt"
                                form={$form}
                                field="scheduledAt"
                                placeholder="Select date"
                                format_string="yyyy-MM-dd"
                                clearable={true}
                            />
                        </FormField>
                        <FormField id="scheduledTime" label="Schedule Time" error={$errors.scheduledTime}>
                            <EnhancedTimePicker
                                id="scheduledTime"
                                name="scheduledTime"
                                form={$form}
                                field="scheduledTime"
                                placeholder="Select time"
                                clearable={true}
                            />
                        </FormField>
                        <!-- Hidden timezone field with default UTC value -->
                        <input type="hidden" name="scheduledAtTimezone" bind:value={$form.scheduledAtTimezone} />
                    </FormRow>

                    <FormRow columns={1}>
                        <FormField id="scheduledAtStartIfMissed" label="Start if Missed" error={$errors.scheduledAtStartIfMissed}>
                            <div class="flex items-center space-x-2">
                                <Checkbox
                                    id="scheduledAtStartIfMissed"
                                    name="scheduledAtStartIfMissed"
                                    checked={$form.scheduledAtStartIfMissed}
                                    onCheckedChange={(checked) => $form.scheduledAtStartIfMissed = !!checked}
                                    disabled={!$form.scheduledAt}
                                />
                                <Label for="scheduledAtStartIfMissed">
                                    Start immediately if scheduled time is missed
                                </Label>
                            </div>
                        </FormField>
                    </FormRow>
                </div>
            </AdminCard>
        </FormContainer>
    </div>
    {/if}
</AdminPageLayout>
