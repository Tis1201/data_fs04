<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, Radio, Copy } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import { Badge } from "$lib/components/ui/badge";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { browser } from "$app/environment";
    
    // Import Admin Layout Components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import Form Components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
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
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        successRedirect: '/admin/settings/listeners',
        validationMethod: 'oninput',
        onError: (error) => {
            toast.error("An error occurred while creating the event listener");
            console.error('Form submission error:', error);
        },
        onSuccess: (result) => {
            toast.success("Event listener created successfully");
        }
    });
    
    // Get webhook endpoints and WhatsApp accounts from data
    const { webhookEndpoints, whatsappAccounts, samplePostfix } = data;
    
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
    
    // Initialize arrays if undefined
    $: if (!Array.isArray($form.webhookEndpointIds)) {
        $form.webhookEndpointIds = [];
    }
    $: if (!Array.isArray($form.whatsappAccountIds)) {
        $form.whatsappAccountIds = [];
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    actionButtons={[
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto('/admin/settings/listeners'),
            variant: "outline",
            disabled: $submitting
        },
        {
            label: $submitting ? "Creating..." : "Create Listener",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/create"]');
                if (form) form.requestSubmit();
            },
            disabled: $submitting,
            loading: $submitting
        }
    ]}
    loading={$submitting}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <FormContainer 
        method="POST" 
        action="?/create" 
        {enhance} 
        novalidate 
        errorMessage={$errorMessage}
        showAlerts={true}
        disabled={$submitting}
        class="w-full space-y-6"
    >
        <AdminCard
            title="Listener Information"
            description="Create a new event listener endpoint"
            icon={Radio}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={2}>
                    <FormField 
                        id="name" 
                        label="Name" 
                        error={$errors.name}
                        required={true}
                        helpText="Enter a descriptive name for this listener"
                    >
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            bind:value={$form.name}
                            placeholder="My Event Listener"
                            aria-invalid={$errors.name ? 'true' : undefined}
                            disabled={$submitting}
                            class={$errors.name ? 'border-destructive focus:border-destructive' : ''}
                            {...$constraints.name}
                        />
                    </FormField>
                    
                    <FormField 
                        id="status" 
                        label="Status" 
                        error={$errors.status}
                        required={true}
                        helpText="Initial status of the listener"
                    >
                        <div class="flex items-center space-x-2 pt-2">
                            <Checkbox 
                                id="status" 
                                name="status" 
                                checked={$form.status === 'ACTIVE'}
                                onCheckedChange={(checked) => {
                                    $form.status = checked ? 'ACTIVE' : 'INACTIVE';
                                    $form = $form;
                                }}
                                disabled={$submitting}
                                aria-invalid={$errors.status ? 'true' : undefined}
                            />
                            <label for="status" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                Active
                            </label>
                            <div class="text-xs text-muted-foreground">
                                {$form.status === 'ACTIVE' ? 'Listener will be ready to receive events' : 'Listener will be inactive'}
                            </div>
                        </div>
                        <input type="hidden" name="status" value={$form.status} />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField 
                        id="description" 
                        label="Description" 
                        error={$errors.description}
                        helpText="Optional description of the listener's purpose"
                    >
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Describe the purpose of this listener"
                            rows="3"
                            aria-invalid={$errors.description ? 'true' : undefined}
                            disabled={$submitting}
                            class="w-full {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                            {...$constraints.description}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <div class="bg-muted/40 p-4 rounded-lg border border-muted">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium">Endpoint URL Preview</h4>
                            <button
                                type="button"
                                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors"
                                on:click={copyToClipboard}
                            >
                                {#if copied}
                                    <span class="text-green-600 font-medium">Copied!</span>
                                {:else}
                                    <Copy class="h-3.5 w-3.5" /> Copy
                                {/if}
                            </button>
                        </div>
                        <div class="bg-background border rounded-md p-2 font-mono text-xs break-all">
                            {browser ? fullEndpointUrl : `/api/listen/${samplePostfix}`}
                        </div>
                        <p class="text-xs text-muted-foreground mt-2">
                            A unique endpoint URL will be automatically generated when you create the listener.
                            This is just a preview of what it will look like.
                        </p>
                    </div>
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
                                <FormField 
                                    id="listenToAll" 
                                    label=""
                                    error={$errors.listenToAll}
                                >
                                    <div class="flex items-center space-x-2">
                                        <Checkbox 
                                            id="listenToAll" 
                                            name="listenToAll" 
                                            checked={$form.listenToAll}
                                            onCheckedChange={(checked) => {
                                                $form.listenToAll = checked;
                                                if (checked) {
                                                    $form.webhookEndpointIds = [];
                                                    $form.whatsappAccountIds = [];
                                                }
                                                $form = $form;
                                            }}
                                            disabled={$submitting}
                                        />
                                        <div>
                                            <label for="listenToAll" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                Listen to all events
                                            </label>
                                            <p class="text-xs text-muted-foreground mt-1">
                                                Receive events from all webhook endpoints and WhatsApp accounts
                                            </p>
                                        </div>
                                    </div>
                                </FormField>
                                
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
                                                                if (checked) {
                                                                    if (!$form.webhookEndpointIds.includes(endpoint.id)) {
                                                                        $form.webhookEndpointIds = [...$form.webhookEndpointIds, endpoint.id];
                                                                    }
                                                                } else {
                                                                    $form.webhookEndpointIds = $form.webhookEndpointIds.filter(id => id !== endpoint.id);
                                                                }
                                                            }}
                                                            disabled={$submitting}
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
                                                <div class="p-3 bg-amber-50 rounded-md border border-amber-200">
                                                    <p class="text-xs text-amber-700">
                                                        <strong>No webhook endpoints selected</strong> - Select at least one to receive events.
                                                    </p>
                                                </div>
                                            {/if}
                                        {:else}
                                            <div class="p-3 bg-muted/40 rounded-md border border-muted">
                                                <p class="text-xs text-muted-foreground">No webhook endpoints available</p>
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
                                                                if (checked) {
                                                                    if (!$form.whatsappAccountIds.includes(account.id)) {
                                                                        $form.whatsappAccountIds = [...$form.whatsappAccountIds, account.id];
                                                                    }
                                                                } else {
                                                                    $form.whatsappAccountIds = $form.whatsappAccountIds.filter(id => id !== account.id);
                                                                }
                                                            }}
                                                            disabled={$submitting}
                                                        />
                                                        <div class="flex-1">
                                                            <div class="flex items-center gap-2">
                                                                <label for={`whatsapp-${account.id}`} class="text-sm font-medium cursor-pointer">{account.name || 'WhatsApp Account'}</label>
                                                                {#if account.client_status === 'connected'}
                                                                    <Badge variant="outline" class="bg-green-50 text-green-700 border-green-200 text-[10px] py-0 px-1.5">Connected</Badge>
                                                                {:else}
                                                                    <Badge variant="outline" class="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 px-1.5">Disconnected</Badge>
                                                                {/if}
                                                            </div>
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
                                                <div class="p-3 bg-amber-50 rounded-md border border-amber-200">
                                                    <p class="text-xs text-amber-700">
                                                        <strong>No WhatsApp accounts selected</strong> - Select at least one to receive events.
                                                    </p>
                                                </div>
                                            {/if}
                                        {:else}
                                            <div class="p-3 bg-muted/40 rounded-md border border-muted">
                                                <p class="text-xs text-muted-foreground">No WhatsApp accounts available</p>
                                            </div>
                                        {/if}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </FormRow>
                
                <!-- Hidden inputs for arrays -->
                {#if Array.isArray($form.webhookEndpointIds) && $form.webhookEndpointIds.length > 0}
                    {#each $form.webhookEndpointIds as id}
                        <input type="hidden" name="webhookEndpointIds" value={id} />
                    {/each}
                {/if}
                
                {#if Array.isArray($form.whatsappAccountIds) && $form.whatsappAccountIds.length > 0}
                    {#each $form.whatsappAccountIds as id}
                        <input type="hidden" name="whatsappAccountIds" value={id} />
                    {/each}
                {/if}
                {/if}
                
                <!-- Hidden input for listenToAll -->
                <input type="hidden" name="listenToAll" value={$form.listenToAll ? 'true' : 'false'} />
            </div>
        </AdminCard>
    </FormContainer>
</AdminPageLayout>
