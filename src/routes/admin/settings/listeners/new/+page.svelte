<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    // import { DatePicker } from "$lib/components/ui/date-picker";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Copy } from "lucide-svelte";
    import { browser } from "$app/environment";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import EnhancedCheckbox from "$lib/components/ui_components_sveltekit/form/EnhancedCheckbox.svelte";
    import type { PageData } from "./$types";
    
    export let data: PageData;
    const title = "Create Event Listener";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["Event Listeners", "/admin/settings/listeners"],
        "New Listener",
    ];

    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    // Create a form handler with standardized error handling
    // Initialize local state for selected IDs
    let selectedWebhookIds = [];
    let selectedWhatsappIds = [];
    
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/settings/listeners',
        validateOnInput: true,
        debugMode: true,
        onError: (error) => {
            // Display error message
            toast.error("An error occurred while creating the event listener");
            console.error('Form submission error:', error);
        },
        onSuccess: (result) => {
            toast.success("Event listener created successfully");
        }
    });
    
    // Get webhook endpoints and WhatsApp accounts from data
    const { webhookEndpoints, whatsappAccounts } = data;

    // Status options for the select dropdown
    const statusOptions = [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
    ];
    
    // Get the sample postfix from the server data
    const { samplePostfix } = data;
    
    // Generate the full URL for display
    let fullEndpointUrl = "";
    $: if (browser) {
        const origin = window.location.origin;
        fullEndpointUrl = `${origin}/api/listen/${samplePostfix}`;
    }
    
    // Copy URL to clipboard
    let copied = false;
    async function copyToClipboard() {
        if (browser) {
            await navigator.clipboard.writeText(fullEndpointUrl);
            copied = true;
            toast.success("Endpoint URL copied to clipboard");
            setTimeout(() => {
                copied = false;
            }, 2000);
        }
    }
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader {title} />

    <PageContent>
        <FormContainer 
            method="POST" 
            action="?/create" 
            {enhance} 
            novalidate 
            errorMessage={$errorMessage}
        >
            
            <FormCard title="Event Listener Information" error={null}>
                <FormRow columns={1}>
                    <FormField id="name" label="Name" error={$errors.name}>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="My Webhook"
                            aria-invalid={$errors.name ? 'true' : undefined}
                            {...$constraints.name}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <div class="bg-muted/40 p-4 rounded-lg border border-muted">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium">Endpoint URL</h4>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                class="h-8 px-2 text-xs" 
                                on:click={copyToClipboard}
                            >
                                {#if copied}
                                    <span class="text-green-600 font-medium">Copied!</span>
                                {:else}
                                    <Copy class="h-3.5 w-3.5 mr-1" /> Copy
                                {/if}
                            </Button>
                        </div>
                        <div class="bg-background border rounded-md p-2 font-mono text-xs break-all">
                            {browser ? fullEndpointUrl : `/api/listen/${samplePostfix}`}
                        </div>
                        <p class="text-xs text-muted-foreground mt-2">
                            A unique endpoint URL will be automatically generated when you create the event listener.
                            This is just a preview of what it will look like.
                        </p>
                    </div>
                </FormRow>

                <FormRow columns={1}>
                    <FormField id="description" label="Description" error={$errors.description}>
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Describe the purpose of this webhook"
                            rows="3"
                            aria-invalid={$errors.description ? 'true' : undefined}
                            {...$constraints.description}
                        />
                    </FormField>
                </FormRow>

                <FormRow columns={1}>
                    <Card>
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Listener Scope</CardTitle>
                            <CardDescription class="text-xs">
                                Configure which events this listener should receive
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div class="space-y-4">
                                <div>
                                    <EnhancedCheckbox 
                                        name="listenToAll"
                                        bind:checked={$form.listenToAll}
                                        label="Listen to all events"
                                        description="Receive events from all webhook endpoints and WhatsApp accounts"
                                        on:change={() => {
                                            console.log('Checkbox changed:', $form.listenToAll);
                                            // Clear selections when switching to "listen to all"
                                            if ($form.listenToAll) {
                                                $form.webhookEndpointIds = [];
                                                $form.whatsappAccountIds = [];
                                            }
                                        }}
                                    />
                                </div>
                                
                                {#if $form.listenToAll}
                                    <div class="bg-muted/40 p-3 rounded-md border border-muted">
                                        <p class="text-xs text-muted-foreground">
                                            <strong>All events mode:</strong> This listener will receive events from all webhook endpoints and WhatsApp accounts.
                                        </p>
                                    </div>
                                {/if}
                            </div>
                        </CardContent>
                    </Card>
                </FormRow>
                
                {#if !$form.listenToAll}
                <FormRow columns={1}>
                    <Card>
                        <CardHeader class="pb-2">
                            <CardTitle class="text-base">Event Sources</CardTitle>
                            <CardDescription class="text-xs">
                                Select specific webhook endpoints and WhatsApp accounts to listen to
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div>
                                <Tabs defaultValue="webhook" class="w-full">
                                    <TabsList class="grid w-full grid-cols-2">
                                        <TabsTrigger value="webhook">Webhook Endpoints</TabsTrigger>
                                        <TabsTrigger value="whatsapp">WhatsApp Accounts</TabsTrigger>
                                    </TabsList>
                                    
                                    <TabsContent value="webhook" class="pt-4">
                                        <div class="space-y-4">
                                            {#if webhookEndpoints && webhookEndpoints.length > 0}
                                                <div class="grid gap-2">
                                                    {#each webhookEndpoints as endpoint}
                                                        <div class="flex items-center space-x-2 p-2 rounded-md border border-border hover:bg-muted/40">
                                                            <Checkbox 
                                                                id={`webhook-${endpoint.id}`}
                                                                checked={$form.webhookEndpointIds?.includes(endpoint.id) || false}
                                                                onCheckedChange={(checked) => {
                                                                    // Ensure we're working with arrays
                                                                    if (!Array.isArray($form.webhookEndpointIds)) {
                                                                        $form.webhookEndpointIds = [];
                                                                    }
                                                                    
                                                                    if (checked) {
                                                                        // Add the ID if it's not already in the array
                                                                        if (!$form.webhookEndpointIds.includes(endpoint.id)) {
                                                                            $form.webhookEndpointIds = [...$form.webhookEndpointIds, endpoint.id];
                                                                        }
                                                                    } else {
                                                                        // Remove the ID
                                                                        $form.webhookEndpointIds = $form.webhookEndpointIds.filter(id => id !== endpoint.id);
                                                                    }
                                                                    
                                                                    console.log('Updated webhook endpoints:', $form.webhookEndpointIds);
                                                                }}
                                                            />
                                                            <div class="flex-1">
                                                                <label for={`webhook-${endpoint.id}`} class="text-sm font-medium cursor-pointer">{endpoint.name}</label>
                                                                <p class="text-xs text-muted-foreground font-mono">/api/webhook/{endpoint.postfix}</p>
                                                            </div>
                                                        </div>
                                                    {/each}
                                                </div>
                                                
                                                {#if $form.webhookEndpointIds.length > 0}
                                                    <div class="p-3 bg-muted/40 rounded-md border border-muted">
                                                        <p class="text-xs text-muted-foreground">
                                                            <strong>Selected {$form.webhookEndpointIds.length} webhook endpoint{$form.webhookEndpointIds.length !== 1 ? 's' : ''}</strong>
                                                        </p>
                                                    </div>
                                                {:else}
                                                    <div class="p-3 bg-muted/40 rounded-md border border-muted">
                                                        <p class="text-xs text-muted-foreground">
                                                            <strong>No webhook endpoints selected</strong> - Select at least one webhook endpoint to receive events from.
                                                        </p>
                                                    </div>
                                                {/if}
                                            {:else}
                                                <div class="space-y-2">
                                                    <Skeleton class="h-12 w-full" />
                                                    <Skeleton class="h-12 w-full" />
                                                    <Skeleton class="h-12 w-full" />
                                                </div>
                                            {/if}
                                        </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="whatsapp" class="pt-4">
                                        <div class="space-y-4">
                                            {#if whatsappAccounts && whatsappAccounts.length > 0}
                                                <div class="grid gap-2">
                                                    {#each whatsappAccounts as account}
                                                        <div class="flex items-center space-x-2 p-2 rounded-md border border-border hover:bg-muted/40">
                                                            <Checkbox 
                                                                id={`whatsapp-${account.id}`}
                                                                checked={$form.whatsappAccountIds?.includes(account.id) || false}
                                                                onCheckedChange={(checked) => {
                                                                    // Ensure we're working with arrays
                                                                    if (!Array.isArray($form.whatsappAccountIds)) {
                                                                        $form.whatsappAccountIds = [];
                                                                    }
                                                                    
                                                                    if (checked) {
                                                                        // Add the ID if it's not already in the array
                                                                        if (!$form.whatsappAccountIds.includes(account.id)) {
                                                                            $form.whatsappAccountIds = [...$form.whatsappAccountIds, account.id];
                                                                        }
                                                                    } else {
                                                                        // Remove the ID
                                                                        $form.whatsappAccountIds = $form.whatsappAccountIds.filter(id => id !== account.id);
                                                                    }
                                                                    
                                                                    console.log('Updated WhatsApp accounts:', $form.whatsappAccountIds);
                                                                }}
                                                            />
                                                            <div class="flex-1">
                                                                <label for={`whatsapp-${account.id}`} class="text-sm font-medium cursor-pointer">{account.name || 'WhatsApp Account'}</label>
                                                                <p class="text-xs text-muted-foreground font-mono">{account.phoneNumber}</p>
                                                            </div>
                                                        </div>
                                                    {/each}
                                                </div>
                                                
                                                {#if $form.whatsappAccountIds.length > 0}
                                                    <div class="p-3 bg-muted/40 rounded-md border border-muted">
                                                        <p class="text-xs text-muted-foreground">
                                                            <strong>Selected {$form.whatsappAccountIds.length} WhatsApp account{$form.whatsappAccountIds.length !== 1 ? 's' : ''}</strong>
                                                        </p>
                                                    </div>
                                                {:else}
                                                    <div class="p-3 bg-muted/40 rounded-md border border-muted">
                                                        <p class="text-xs text-muted-foreground">
                                                            <strong>No WhatsApp accounts selected</strong> - Select at least one WhatsApp account to receive events from.
                                                        </p>
                                                    </div>
                                                {/if}
                                            {:else}
                                                <div class="space-y-2">
                                                    <Skeleton class="h-12 w-full" />
                                                    <Skeleton class="h-12 w-full" />
                                                    <Skeleton class="h-12 w-full" />
                                                </div>
                                            {/if}
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </CardContent>
                    </Card>
                </FormRow>
                {/if}
                
                <FormRow columns={1}>
                    <FormField id="status" label="Status" error={$errors.status}>
                        <div class="flex items-center space-x-4 pt-2">
                            <div class="flex items-center space-x-2">
                                <Checkbox 
                                    id="status" 
                                    name="status" 
                                    checked={$form.status === 'ACTIVE'}
                                    on:change={(e) => {
                                        $form.status = e.target.checked ? 'ACTIVE' : 'INACTIVE';
                                    }}
                                    aria-invalid={$errors.status ? 'true' : undefined}
                                    {...$constraints.status}
                                    value="ACTIVE"
                                />
                                <label for="status" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                    Active
                                </label>
                            </div>
                            <div class="text-xs text-muted-foreground">
                                {$form.status === 'ACTIVE' ? 'Listener will be active and ready to receive events' : 'Listener will be created in inactive state'}
                            </div>
                        </div>
                    </FormField>

                    <!-- <FormField id="expiresAt" label="Expiration Date (Optional)" error={$errors.expiresAt}>
                        <DatePicker
                            id="expiresAt"
                            name="expiresAt"
                            bind:value={$form.expiresAt}
                            placeholder="Select expiration date"
                            aria-invalid={$errors.expiresAt ? 'true' : undefined}
                            {...$constraints.expiresAt}
                        />
                        <p class="text-xs text-muted-foreground mt-1">
                            If set, the webhook will automatically become inactive after this date.
                        </p>
                    </FormField> -->
                </FormRow>

                <!-- Add explicit hidden fields for arrays -->
                {#if !$form.listenToAll}
                    {#if Array.isArray($form.webhookEndpointIds) && $form.webhookEndpointIds.length > 0}
                        {#each $form.webhookEndpointIds as id, i}
                            <input type="hidden" name="webhookEndpointIds" value={id} />
                        {/each}
                    {/if}
                    
                    {#if Array.isArray($form.whatsappAccountIds) && $form.whatsappAccountIds.length > 0}
                        {#each $form.whatsappAccountIds as id, i}
                            <input type="hidden" name="whatsappAccountIds" value={id} />
                        {/each}
                    {/if}
                {/if}
                
                <!-- Always include the listenToAll value -->
                <input type="hidden" name="listenToAll" value={$form.listenToAll ? 'true' : 'false'} />
                
                <FormActions>
                    <Button
                        type="button"
                        variant="outline"
                        on:click={() => goto("/admin/settings/listeners")}
                        disabled={$submitting}
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        disabled={$submitting} 
                        class="min-w-[120px] relative"
                    >
                        {#if $submitting}
                            <span class="absolute inset-0 flex items-center justify-center">
                                <Skeleton class="h-4 w-20" />
                            </span>
                            <span class="opacity-0">Create Listener</span>
                        {:else}
                            Create Listener
                        {/if}
                    </Button>
                </FormActions>
            </FormCard>
        </FormContainer>
    </PageContent>
</PageContainer>