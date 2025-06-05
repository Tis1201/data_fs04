<script lang="ts">
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { goto } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Save, X, ArrowLeft, Package } from "lucide-svelte";
    import { Switch } from "$lib/components/ui/switch";
    import { Label } from "$lib/components/ui/label";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import { AdminCard } from "$lib/components/admin";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import EnhancedDatePicker from "$lib/components/ui_components_sveltekit/form/EnhancedDatePicker.svelte";
    import EnhancedTimePicker from "$lib/components/ui_components_sveltekit/form/EnhancedTimePicker.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;
    const { bundle, accounts } = data;
    const title = `Edit ${bundle.name || "Bundle"}`;

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        [bundle.name || "Bundle", `/admin/iot/bundles/${bundle.id}`],
        ["Edit", ""]
    ];

    // Setup the form
    const { form, errors, enhance, submitting } = superForm(data.form, {
        onUpdated: ({ form }) => {
            if (form.data.success) {
                toast.success(form.data.message || "Bundle updated successfully");
            }
        },
        resetForm: false,
        taintedMessage: null
    });

    // OS options for the dropdown
    const osOptions = [
        { value: 'ANDROID', label: 'Android' },
        { value: 'IOS', label: 'iOS' },
        { value: 'WINDOWS', label: 'Windows' },
        { value: 'LINUX', label: 'Linux' },
        { value: 'MACOS', label: 'macOS' }
    ];
    
    // Update strategy options
    const updateStrategyOptions = [
        { value: 'IMMEDIATE', label: 'Immediate' },
        { value: 'ON_REBOOT', label: 'On Reboot' }
    ];
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title={title}>
        <div slot="action" class="flex items-center space-x-2">
            <Button 
                type="submit" 
                form="bundle-edit-form"
                disabled={$submitting}
                variant="default"
                class="flex items-center"
            >
                <Save class="mr-2 h-4 w-4" />
                {$submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            
            <Button 
                variant="outline"
                on:click={() => goto(`/admin/iot/bundles/${bundle.id}`)}
                class="flex items-center"
            >
                <X class="mr-2 h-4 w-4" />
                Cancel
            </Button>
        </div>
    </PageHeader>
    
    <PageContent>
        <div class="space-y-6">
            <!-- Bundle Info Card -->
            <AdminCard
                title="Bundle Information"
                description="Edit details for this bundle."
                icon={Package}
                compact={true}
            >
                <!-- Edit Form -->
                <FormContainer 
                    id="bundle-edit-form" 
                    action="?/save" 
                    enhance={enhance}
                    novalidate
                >
                    <div class="space-y-6">
                        <FormRow columns={2}>
                            <FormField 
                                id="name" 
                                label="Bundle Name" 
                                error={$errors.name} 
                                required={true}
                            >
                                <Input 
                                    id="name" 
                                    name="name" 
                                    placeholder="Enter bundle name"
                                    bind:value={$form.name}
                                    disabled={$submitting}
                                />
                            </FormField>
                            
                            <FormField 
                                id="accountId" 
                                label="Account"
                                error={$errors.accountId}
                            >
                                <EnhancedSelect
                                    id="accountId"
                                    name="accountId"
                                    placeholder="Select an account"
                                    bind:value={$form.accountId}
                                    disabled={$submitting}
                                >
                                    <option value="">None</option>
                                    {#each accounts as account}
                                        <option value={account.id}>{account.name}</option>
                                    {/each}
                                </EnhancedSelect>
                            </FormField>
                        </FormRow>

                        <FormField 
                            id="description" 
                            label="Description"
                            error={$errors.description}
                        >
                            <Textarea
                                id="description"
                                name="description"
                                placeholder="Enter bundle description"
                                bind:value={$form.description}
                                rows={3}
                                disabled={$submitting}
                            />
                        </FormField>

                        <FormRow columns={3}>
                            <FormField 
                                id="os" 
                                label="Operating System"
                                error={$errors.os}
                                required={true}
                            >
                                <EnhancedSelect
                                    id="os"
                                    name="os"
                                    placeholder="Select OS"
                                    bind:value={$form.os}
                                    disabled={$submitting}
                                >
                                    {#each osOptions as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </EnhancedSelect>
                            </FormField>
                            
                            <FormField 
                                id="version" 
                                label="Version"
                                error={$errors.version}
                            >
                                <Input
                                    id="version"
                                    name="version"
                                    placeholder="Enter version"
                                    bind:value={$form.version}
                                    disabled={$submitting}
                                />
                            </FormField>
                            
                            <FormField 
                                id="waveSize" 
                                label="Wave Size"
                                error={$errors.waveSize}
                            >
                                <Input
                                    id="waveSize"
                                    name="waveSize"
                                    type="number"
                                    min="0"
                                    placeholder="Enter wave size"
                                    bind:value={$form.waveSize}
                                    disabled={$submitting}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={2}>
                            <FormField 
                                id="scheduledAt" 
                                label="Scheduled Date"
                                error={$errors.scheduledAt}
                            >
                                <EnhancedDatePicker
                                    id="scheduledAt"
                                    name="scheduledAt"
                                    bind:value={$form.scheduledAt}
                                    disabled={$submitting}
                                />
                            </FormField>
                            
                            <FormField 
                                id="updateStrategy" 
                                label="Update Strategy"
                                error={$errors.updateStrategy}
                                required={true}
                            >
                                <EnhancedSelect
                                    id="updateStrategy"
                                    name="updateStrategy"
                                    placeholder="Select strategy"
                                    bind:value={$form.updateStrategy}
                                    disabled={$submitting}
                                >
                                    {#each updateStrategyOptions as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </EnhancedSelect>
                            </FormField>
                        </FormRow>

                        <div class="p-3 rounded-md bg-muted/50">
                            <h4 class="text-sm font-medium mb-2">Device Behavior</h4>
                            <div class="space-y-3">
                                <FormField id="reboot" label="Reboot Device" error={$errors.reboot}>
                                    <div class="flex items-center space-x-2">
                                        <Switch
                                            id="reboot"
                                            name="reboot"
                                            checked={$form.reboot}
                                            onchange={(e) => $form.reboot = e.currentTarget.checked}
                                            disabled={$submitting}
                                        />
                                        <Label for="reboot">Reboot device after update</Label>
                                    </div>
                                </FormField>
                                
                                <FormField id="forceUpdate" label="Force Update" error={$errors.forceUpdate}>
                                    <div class="flex items-center space-x-2">
                                        <Switch
                                            id="forceUpdate"
                                            name="forceUpdate"
                                            checked={$form.forceUpdate}
                                            onchange={(e) => $form.forceUpdate = e.currentTarget.checked}
                                            disabled={$submitting}
                                        />
                                        <Label for="forceUpdate">Force update installation</Label>
                                    </div>
                                </FormField>
                                
                                <FormField id="notifyUser" label="Notify User" error={$errors.notifyUser}>
                                    <div class="flex items-center space-x-2">
                                        <Switch
                                            id="notifyUser"
                                            name="notifyUser"
                                            checked={$form.notifyUser}
                                            onchange={(e) => $form.notifyUser = e.currentTarget.checked}
                                            disabled={$submitting}
                                        />
                                        <Label for="notifyUser">Show notification to user</Label>
                                    </div>
                                </FormField>
                                
                                {#if $form.notifyUser}
                                    <div class="pl-6 pt-2 space-y-3">
                                        <FormField 
                                            id="notificationTitle" 
                                            label="Notification Title"
                                            error={$errors.notificationTitle}
                                        >
                                            <Input
                                                id="notificationTitle"
                                                name="notificationTitle"
                                                placeholder="Enter notification title"
                                                bind:value={$form.notificationTitle}
                                                disabled={$submitting}
                                            />
                                        </FormField>
                                        
                                        <FormField 
                                            id="notificationMessage" 
                                            label="Notification Message"
                                            error={$errors.notificationMessage}
                                        >
                                            <Textarea
                                                id="notificationMessage"
                                                name="notificationMessage"
                                                placeholder="Enter notification message"
                                                bind:value={$form.notificationMessage}
                                                rows={2}
                                                disabled={$submitting}
                                            />
                                        </FormField>
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <!-- Hidden ID field -->
                        <input type="hidden" name="id" bind:value={$form.id} />
                    </div>
                </FormContainer>
            </AdminCard>
        </div>
    </PageContent>
</PageContainer>
