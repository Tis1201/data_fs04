<script lang="ts">
    import { goto, invalidate } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { zod } from 'sveltekit-superforms/adapters';
    import { toast } from "svelte-sonner";
    import { ArrowLeft, Save, Radio, Trash } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Badge } from "$lib/components/ui/badge";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    
    // Import Admin Layout Components
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    
    // Import Form Components
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { Checkbox } from "$lib/components/ui/checkbox";
    import RecordDeleteDialog from "$lib/components/ui_components_sveltekit/dialog/RecordDeleteDialog.svelte";
    import type { PageData } from "./$types";
    import { LISTENER_STATUSES, listenerEditSchema } from "./schema";

    export let data: PageData;
    import { truncateText } from "$lib/utils/text-utils";
    const { listener, webhookEndpoints, whatsappAccounts } = data;
    const title = `Edit Listener: ${truncateText(listener?.name || 'Listener', 40)}`;
    
    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["Event Listeners", "/admin/settings/listeners"],
        truncateText(listener?.name || "Edit Listener", 40),
    ];
    
    const { form, errors, enhance, submitting, message, delayed, timeout } = superForm(data.form, {
        validators: zod(listenerEditSchema), // Add client-side validation
        taintedMessage: 'You have unsaved changes. Are you sure you want to leave?',
        invalidateAll: false, // Prevent automatic invalidation
        resetForm: false, // Don't reset the form after submission
        validationMethod: 'oninput', // Validate on every input change
        delayMs: 500, // Show loading state after 500ms
        timeoutMs: 8000, // Timeout after 8 seconds
        
        onResult: async ({ result }) => {
            if (result.type === "success") {
                // Show success message
                toast.success("Listener updated successfully!", {
                    description: "All changes have been saved.",
                    duration: 4000
                });
                
                // Manually invalidate to get fresh data
                await invalidate();
            } else if (result.type === "failure") {
                // Handle form validation errors
                if (result.data?.form?.message) {
                    toast.error("Validation Error", {
                        description: result.data.form.message.text || "Please check your input and try again.",
                        duration: 6000
                    });
                } else {
                    toast.error("Failed to update listener", {
                        description: "Please check your input and try again.",
                        duration: 6000
                    });
                }
            } else if (result.type === "error") {
                // Handle server errors
                toast.error("Server Error", {
                    description: "An unexpected error occurred. Please try again later.",
                    duration: 6000
                });
            }
        },
        
        onError: ({ result }) => {
            console.error("Form submission error:", result);
            toast.error("Connection Error", {
                description: "Unable to connect to the server. Please check your connection and try again.",
                duration: 6000
            });
        }
    });
    
    // Enhanced message handling for FormContainer (only errors, success uses toast)
    $: errorMessage = $message?.type === 'error' ? { 
        text: $message.text || 'An error occurred',
        details: $message.details,
        code: $message.code 
    } : null;
    
    // Loading state management
    $: isLoading = $submitting || $delayed;
    $: hasTimeout = $timeout;
    
    // State for delete confirmation dialog
    let deleteState = {
        selectedRecord: null as typeof listener | null,
        confirmationOpen: false
    };

    // Function to open delete confirmation dialog
    function confirmDelete() {
        deleteState.selectedRecord = listener;
        deleteState.confirmationOpen = true;
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
            label: "Delete",
            icon: Trash,
            onClick: confirmDelete,
            variant: "destructive",
            disabled: isLoading
        },
        {
            label: "Cancel",
            icon: ArrowLeft,
            onClick: () => goto('/admin/settings/listeners'),
            variant: "outline",
            disabled: isLoading
        },
        {
            label: isLoading ? ($delayed ? "Saving..." : "Processing...") : "Save Changes",
            icon: Save,
            onClick: () => {
                const form = document.querySelector('form[action="?/save"]');
                if (form) form.requestSubmit();
            },
            disabled: isLoading,
            loading: isLoading
        }
    ]}
    loading={isLoading}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <FormContainer 
        method="POST" 
        action="?/save" 
        {enhance} 
        novalidate 
        {errorMessage}
        showAlerts={true}
        disabled={isLoading}
        {hasTimeout}
        {isLoading}
        delayed={$delayed}
        class="w-full space-y-6"
    >
        <AdminCard
            title="Listener Information"
            description="Edit event listener details"
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
                            placeholder="Enter listener name" 
                            disabled={isLoading}
                            aria-invalid={$errors.name ? 'true' : undefined}
                            class={$errors.name ? 'border-destructive focus:border-destructive' : ''}
                        />
                    </FormField>
                    
                    <FormField 
                        id="status" 
                        label="Status" 
                        error={$errors.status}
                        required={true}
                        helpText="Current operational status of the listener"
                    >
                        <EnhancedSelect
                            name="status"
                            options={[
                                { value: "ACTIVE", label: "Active" },
                                { value: "INACTIVE", label: "Inactive" }
                            ]}
                            bind:value={$form.status}
                            disabled={isLoading}
                            placeholder="Select status"
                            aria-invalid={$errors.status ? 'true' : undefined}
                            className={$errors.status ? 'border-destructive' : ''}
                        />
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
                            placeholder="Enter listener description" 
                            disabled={isLoading}
                            class="w-full h-24 {$errors.description ? 'border-destructive focus:border-destructive' : ''}"
                            aria-invalid={$errors.description ? 'true' : undefined}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <div class="bg-muted/40 p-4 rounded-lg border border-muted">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="text-sm font-medium">Endpoint URL</h4>
                        </div>
                        <div class="bg-background border rounded-md p-2 font-mono text-xs break-all">
                            {#if typeof window !== 'undefined'}
                                {window.location.origin}/api/listen/{listener.postfix}
                            {:else}
                                /api/listen/{listener.postfix}
                            {/if}
                        </div>
                        <p class="text-xs text-muted-foreground mt-2">
                            This is your listener endpoint URL. It cannot be changed.
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
                                                // Clear selections when switching to "listen to all"
                                                if (checked) {
                                                    $form.webhookEndpointIds = [];
                                                    $form.whatsappAccountIds = [];
                                                }
                                                // Force reactive update
                                                $form = $form;
                                            }}
                                            disabled={isLoading}
                                            aria-invalid={$errors.listenToAll ? 'true' : undefined}
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
                                    <!-- Hidden input to ensure listenToAll is submitted -->
                                    <input type="hidden" name="listenToAll" value={$form.listenToAll} />
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
                                                            disabled={isLoading}
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
                                                            disabled={isLoading}
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
                
                <!-- Metadata -->
                {#if listener}
                    <div class="pt-4 border-t">
                        <h4 class="text-sm font-medium mb-2">Metadata</h4>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-muted-foreground">Created:</span>
                                <span class="ml-2">{new Date(listener.createdAt).toLocaleString()}</span>
                            </div>
                            <div>
                                <span class="text-muted-foreground">Updated:</span>
                                <span class="ml-2">{new Date(listener.updatedAt).toLocaleString()}</span>
                            </div>
                            <div>
                                <span class="text-muted-foreground">ID:</span>
                                <span class="ml-2 font-mono text-xs">{listener.id}</span>
                            </div>
                            <div>
                                <span class="text-muted-foreground">Postfix:</span>
                                <span class="ml-2 font-mono text-xs">{listener.postfix}</span>
                            </div>
                            {#if listener.lastSeenAt}
                                <div>
                                    <span class="text-muted-foreground">Last Active:</span>
                                    <span class="ml-2">{new Date(listener.lastSeenAt).toLocaleString()}</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        </AdminCard>
    </FormContainer>
</AdminPageLayout>

<!-- Delete Confirmation Dialog -->
<RecordDeleteDialog
    state={deleteState}
    action="?/deleteListener"
    actionName="deleteListener"
    onConfirm={() => {
        // Navigate back to listeners list after successful deletion
        goto('/admin/settings/listeners');
    }}
/>
