<script lang="ts">
    import { goto } from '$app/navigation';
    import { ArrowLeft, Plus, Search } from 'lucide-svelte';
    import { page } from '$app/stores';
    import { superForm } from 'sveltekit-superforms/client';
    import { toast } from 'svelte-sonner';
    import { invalidate } from '$app/navigation';
    
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Label } from "$lib/components/ui/label";
    import { Switch } from "$lib/components/ui/switch";
    import { Input } from "$lib/components/ui/input";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import ResourceSelect from "$lib/components/ui_components_sveltekit/form/ResourceSelect.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import * as Tabs from "$lib/components/ui/tabs";
    
    export let data;
    const { bundle = {}, resources = [], form: formData = {}, search = { query: '', type: 'APK', total: 0, hasMore: false } } = data || {};
    
    const title = `Add App to Bundle: ${bundle?.name || bundle?.id || 'Unknown'}`;
    
    // Define breadcrumbs for this page
    const bundleId = bundle?.id || $page.params.id || '';
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["IoT", "/admin/iot"],
        ["Bundles", "/admin/iot/bundles"],
        [bundle?.name || "Bundle", `/admin/iot/bundles/${bundleId}`],
        ["Apps", `/admin/iot/bundles/${bundleId}`],
        ["Add App", ""]
    ];
    
    // Search state
    let searchQuery = search.query || '';
    let selectedType = search.type || 'APK';
    const resourceTypes = ['APK', 'IPA', 'ZIP', 'OTHER'];
    
    // Handle search
    async function handleSearch() {
        const url = new URL(window.location.href);
        url.searchParams.set('query', searchQuery);
        url.searchParams.set('type', selectedType);
        await invalidate(`/admin/iot/bundles/${bundle.id}/apps/add`);
        window.history.pushState({}, '', url.toString());
    }
    
    // Set up the form
    const { form, errors, constraints, enhance, submitting, message } = superForm(formData, {
        resetForm: true,
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('App added to bundle successfully');
                goto(`/admin/iot/bundles/${bundleId}`);
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
        onClick: () => goto(`/admin/iot/bundles/${bundleId}`),
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
                <!-- Search and filter controls -->
                <div class="mb-6 space-y-4">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <div class="relative flex-1">
                            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                type="search" 
                                placeholder="Search apps..." 
                                class="pl-8" 
                                bind:value={searchQuery}
                                on:keydown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <div class="w-full sm:w-40">
                            <Tabs.Root value={selectedType} onValueChange={(value) => { selectedType = value; handleSearch(); }}>
                                <Tabs.List class="grid grid-cols-4 w-full">
                                    {#each resourceTypes as type}
                                        <Tabs.Trigger value={type} class="text-xs">{type}</Tabs.Trigger>
                                    {/each}
                                </Tabs.List>
                            </Tabs.Root>
                        </div>
                        <Button variant="outline" on:click={handleSearch} class="shrink-0">
                            <Search class="h-4 w-4 mr-2" />
                            Search
                        </Button>
                    </div>
                    
                    <!-- Search stats -->
                    <div class="text-sm text-muted-foreground">
                        Found {search.total} apps
                        {#if searchQuery}
                            matching "{searchQuery}"
                        {/if}
                        {#if selectedType}
                            of type <Badge variant="outline">{selectedType}</Badge>
                        {/if}
                    </div>
                </div>
                
                <FormContainer method="POST" enhance={enhance}>
                    <FormRow>
                        <FormField
                            name="resourceId"
                            label="App"
                            required={true}
                            error={$errors.resourceId}
                        >
                            <ResourceSelect
                                bind:value={$form.resourceId}
                                placeholder="Select an app"
                                searchPlaceholder="Find an app..."
                                resources={resources}
                                required={true}
                                error={$errors.resourceId}
                            />
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
                            on:click={() => goto(`/admin/iot/bundles/${bundleId}`)}
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
