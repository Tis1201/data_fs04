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
    const pageCrumbs: [string, string][] = [
        ["Home", "/user"],
        ["IoT", ""],
        ["Bundles", "/user/iot/bundles"],
        [bundle.name || "Bundle", `/user/iot/bundles/${bundle.id}`],
        ["Edit", ""]
    ];

    // Setup the form
    const { form, errors, enhance, submitting } = superForm(data.form, {
        onUpdated: ({ form }) => {
            if (form.data?.success) {
                toast.success(form.data.message || "Bundle updated successfully");
            }
        },
        onResult: ({ result }) => {
            try {
                if (result?.type === 'success') {
                    goto(`/user/iot/bundles/${bundle.id}`);
                    return;
                }
            } catch {}
        },
        resetForm: false,
        taintedMessage: null
    });

    // When loading existing record, derive local time input from scheduledAt (ISO string)
    $: if ($form?.scheduledAt && !$form?.scheduledTime) {
        try {
            const d = new Date($form.scheduledAt);
            if (!isNaN(d.getTime())) {
                const hh = String(d.getHours()).padStart(2, '0');
                const mm = String(d.getMinutes()).padStart(2, '0');
                $form.scheduledTime = `${hh}:${mm}`;
            }
        } catch {}
    }

    // Helper to normalize error shapes to a single string or null
    function err(val: unknown): string | null {
        return Array.isArray(val) ? (val[0] ?? null) : (typeof val === 'string' ? val : null);
    }

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
                on:click={() => goto(`/user/iot/bundles/${bundle.id}`)}
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
                                error={err($errors.name)}
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
                        </FormRow>

                            <FormField 
                                id="description" 
                                label="Description"
                                error={err($errors.description)}
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

                        <FormRow columns={2}>
                            <FormField 
                                id="os" 
                                label="Operating System"
                                error={err($errors.os)}
                                required={true}
                            >
                                <EnhancedSelect
                                    id="os"
                                    name="os"
                                    placeholder="Select OS"
                                    options={osOptions}
                                    bind:value={$form.os}
                                    disabled={$submitting}
                                />
                            </FormField>
                            
                            <FormField 
                                id="version" 
                                label="Version"
                                error={err($errors.version)}
                            >
                                <Input
                                    id="version"
                                    name="version"
                                    placeholder="Enter version"
                                    bind:value={$form.version}
                                    disabled={$submitting}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={3}>
                            <FormField 
                                id="waveSize" 
                                label="Wave Size"
                                error={err($errors.waveSize)}
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
                            <FormField id="scheduledAt" label="Scheduled Date" error={err($errors.scheduledAt)}>
                                <EnhancedDatePicker
                                    id="scheduledAt"
                                    name="scheduledAt"
                                    form={$form}
                                    field="scheduledAt"
                                    disabled={$submitting}
                                    minDate={new Date()}
                                    showFutureDates={true}
                                    timelineOptions="future"
                                    defaultTimeline="future"
                                />
                            </FormField>
                            <FormField id="scheduledTime" label="Scheduled Time (HH:mm)" error={err($errors.scheduledTime)}>
                                <Input
                                    id="scheduledTime"
                                    name="scheduledTime"
                                    type="time"
                                    step="60"
                                    bind:value={(($form).scheduledTime)}
                                    disabled={$submitting}
                                />
                            </FormField>
                        </FormRow>

                        <FormRow columns={1}>
                            <FormField id="activePeriodDays" label="Active Period (Days)" error={err($errors.activePeriodDays)}>
                                <div class="space-y-2">
                                    <Input
                                        id="activePeriodDays"
                                        name="activePeriodDays"
                                        type="number"
                                        bind:value={$form.activePeriodDays}
                                        placeholder="1"
                                        min="1"
                                        max="30"
                                        disabled={$submitting}
                                        aria-invalid={$errors.activePeriodDays ? 'true' : undefined}
                                        on:input={(e) => {
                                            if ($submitting) return;
                                            const val = Number(e.currentTarget.value);
                                            if (val > 30) {
                                                $form.activePeriodDays = 30;
                                            } else if (val < 1 && val !== 0) {
                                                $form.activePeriodDays = 1;
                                            }
                                        }}
                                    />
                                    <p class="text-xs text-muted-foreground">
                                        How long devices can automatically receive this bundle after it starts (1-30 days). 
                                        Default: 1 day. Late device responses will be accepted during this period.
                                    </p>
                                </div>
                            </FormField>
                        </FormRow>

                        <div class="p-3 rounded-md bg-muted/50">
                            <h4 class="text-sm font-medium mb-2">Device Behavior</h4>
                            <div class="space-y-3">
                                <FormField id="reboot" label="Reboot Device" error={err($errors.reboot)}>
                                    <div class="flex items-center space-x-2">
                                        <Switch
                                            id="reboot"
                                            name="reboot"
                                            bind:checked={$form.reboot}
                                            disabled={$submitting}
                                        />
                                        <Label for="reboot">Reboot device after update</Label>
                                    </div>
                                </FormField>
                                
                                <FormField id="forceUpdate" label="Force Update" error={err($errors.forceUpdate)}>
                                    <div class="flex items-center space-x-2">
                                        <Switch
                                            id="forceUpdate"
                                            name="forceUpdate"
                                            bind:checked={$form.forceUpdate}
                                            disabled={$submitting}
                                        />
                                        <Label for="forceUpdate">Force update installation</Label>
                                    </div>
                                </FormField>
                                <FormField id="autoOpen" label="Auto Open" error={err($errors.autoOpen)}>
                                    <div class="flex items-center space-x-2">
                                        <Switch
                                            id="autoOpen"
                                            name="autoOpen"
                                            bind:checked={$form.autoOpen}
                                            disabled={$submitting}
                                        />
                                        <Label for="autoOpen">Open app automatically after installation</Label>
                                    </div>
                                </FormField>
                                
                                <!-- Notify User fields removed per product decision -->
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
