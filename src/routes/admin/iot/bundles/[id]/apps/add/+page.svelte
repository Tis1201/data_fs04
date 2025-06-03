<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Plus } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { superForm } from 'sveltekit-superforms/client';
    import { toast } from 'svelte-sonner';
    
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import { Switch } from "$lib/components/ui/switch";
    import { Input } from "$lib/components/ui/input";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import * as Select from "$lib/components/ui/select";
    
    export let data;
    const { bundle, resources, form: formData } = data;
    
    const title = `Add App to Bundle: ${bundle.name || bundle.id}`;
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        [bundle.name || "Bundle", `/admin/iot/bundles/${bundle.id}`],
        ["Apps", `/admin/iot/bundles/${bundle.id}/apps`],
        ["Add", ""]
    ];
    
    // Set up the form
    const { form, errors, constraints, enhance, submitting, message } = superForm(formData, {
        resetForm: true,
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('App added to bundle successfully');
                goto(`/admin/iot/bundles/${bundle.id}/apps`);
            }
        },
        onError: ({ result }) => {
            toast.error('Failed to add app to bundle');
        }
    });
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
      {
        label: "Back",
        icon: ArrowLeft,
        onClick: () => goto(`/admin/iot/bundles/${bundle.id}/apps`),
        variant: "outline",
        class: "h-9"
      }
    ]}
>
    <div class="w-full space-y-6">
        <Card class="w-full">
            <CardHeader>
                <CardTitle>Add App to Bundle</CardTitle>
                <CardDescription>
                    Select an app to add to this bundle
                </CardDescription>
            </CardHeader>
            <CardContent>
                <FormContainer method="POST" use:enhance>
                    <FormRow>
                        <FormField
                            name="resourceId"
                            label="App"
                            required={true}
                            error={$errors.resourceId}
                        >
                            <Select.Root
                                bind:value={$form.resourceId}
                                error={$errors.resourceId}
                            >
                                <Select.Trigger class="w-full">
                                    <Select.Value placeholder="Select an app" />
                                </Select.Trigger>
                                <Select.Content>
                                    {#each resources as resource}
                                        <Select.Item value={resource.id}>{resource.name}</Select.Item>
                                    {/each}
                                </Select.Content>
                            </Select.Root>
                        </FormField>
                    </FormRow>
                    
                    <FormRow>
                        <FormField
                            name="order"
                            label="Installation Order"
                            required={true}
                            error={$errors.order}
                        >
                            <Input
                                type="number"
                                min="1"
                                bind:value={$form.order}
                                error={$errors.order}
                            />
                        </FormField>
                    </FormRow>
                    
                    <FormRow>
                        <FormField
                            name="autoOpen"
                            label="Auto Open"
                            error={$errors.autoOpen}
                        >
                            <div class="flex items-center space-x-2">
                                <Switch
                                    id="autoOpen"
                                    bind:checked={$form.autoOpen}
                                    error={$errors.autoOpen}
                                />
                                <Label for="autoOpen">Automatically open app after installation</Label>
                            </div>
                        </FormField>
                    </FormRow>
                    
                    <div class="flex justify-end space-x-2 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            on:click={() => goto(`/admin/iot/bundles/${bundle.id}/apps`)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={$submitting}
                        >
                            {$submitting ? 'Adding...' : 'Add App'}
                        </Button>
                    </div>
                </FormContainer>
            </CardContent>
        </Card>
    </div>
</AdminPageLayout>
