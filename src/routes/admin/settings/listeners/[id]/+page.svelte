<script lang="ts">
    import { goto } from "$app/navigation";
    import { superForm } from "sveltekit-superforms/client";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Select from "$lib/components/ui/select/index.js";
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Badge } from "$lib/components/ui/badge";
    import { Switch } from "$lib/components/ui/switch/index.js";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import { Clock, Link } from "lucide-svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import type { PageData } from "./$types";
    import { LISTENER_STATUSES } from "./schema";

    export let data: PageData;
    const { listener } = data;
    const title = listener ? "Edit Listener" : "New Listener";
    
    console.log('Page data:', data);
    console.log('Listener:', listener);

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["Listeners", "/admin/settings/listeners"],
        listener?.name || "Edit Listener",
    ];
    
    // Get status badge variant based on status value
    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'success';
            case 'INACTIVE': return 'secondary';
            default: return 'outline';
        }
    };

    // Track if data is loaded
    let dataLoaded = !!listener;
    
    const { form, errors, enhance, submitting } = superForm(data.form, {
        onResult: async ({ result }) => {
            if (result.type === "success") {
                toast.success("Listener updated successfully");
                try {
                    await goto("/admin/settings/listeners");
                } catch (error) {
                    console.error("Navigation error:", error);
                    toast.error("Failed to redirect. Please try again.");
                }
            }
        },
        onError: (err) => {
            toast.error(err.message);
        }
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader {title} />

    <PageContent>
        {#if !dataLoaded || $submitting}
            <div class="space-y-4">
                <Skeleton class="h-8 w-full" />
                <Skeleton class="h-4 w-3/4" />
                <Skeleton class="h-32 w-full" />
                <Skeleton class="h-10 w-1/2" />
            </div>
        {:else}
            <!-- Listener Info Card -->
            <FormCard
                {title}
                description="Edit details for this event listener"
                loading={$submitting}
                footerSlot={listener}
            >
                <FormContainer {enhance} action="?/save">
                    <!-- Name -->
                    <FormField
                        id="name"
                        label="Name"
                        error={$errors.name}
                    >
                        <Input
                            id="name"
                            name="name"
                            bind:value={$form.name}
                            placeholder="Enter listener name"
                        />
                    </FormField>

                    <!-- Description -->
                    <FormField
                        id="description"
                        label="Description"
                        error={$errors.description}
                    >
                        <Textarea
                            id="description"
                            name="description"
                            bind:value={$form.description}
                            placeholder="Enter description (optional)"
                            rows={3}
                        />
                    </FormField>

                    <!-- Two-column layout for shorter fields -->
                    <FormRow columns={2}>
                        <!-- Status -->
                        <FormField id="status" label="Status" error={$errors.status}>
                            <EnhancedSelect
                                value={$form.status}
                                name="status"
                                placeholder="Select status"
                                labelText="Status"
                                portal={null}
                                on:change={(e) => ($form.status = e.detail)}
                            >
                                {#each LISTENER_STATUSES as status}
                                    <Select.Item value={status}>{status}</Select.Item>
                                {/each}
                            </EnhancedSelect>
                        </FormField>

                        <!-- Listen to All -->
                        <FormField 
                            id="listenToAll" 
                            label="Listen to All Events" 
                            error={$errors.listenToAll}
                            description="When enabled, this listener will receive all events"
                        >
                            <div class="flex items-center space-x-2">
                                <Switch 
                                    id="listenToAll"
                                    name="listenToAll"
                                    checked={$form.listenToAll} 
                                    onCheckedChange={(checked) => $form.listenToAll = checked}
                                />
                                <span>{$form.listenToAll ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        </FormField>
                    </FormRow>

                    <!-- Postfix (Read-only) -->
                    {#if listener?.postfix}
                        <FormField
                            id="postfix"
                            label="Endpoint ID"
                            description="Unique identifier for this listener endpoint"
                        >
                            <div class="flex items-center space-x-2 p-2 border rounded-md bg-muted/20">
                                <code class="text-sm font-mono">{listener.postfix}</code>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    class="h-8 w-8"
                                    title="Copy to clipboard"
                                    on:click={() => {
                                        navigator.clipboard.writeText(listener.postfix);
                                        toast.success("Copied to clipboard");
                                    }}
                                >
                                    <Link size={14} />
                                </Button>
                            </div>
                        </FormField>
                    {/if}

                    <!-- Submit Button -->
                    <FormRow columns={1} alignItems="end">
                        <FormActions>
                            <Button
                                variant="outline"
                                type="button"
                                on:click={() => goto('/admin/settings/listeners')}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">Save Changes</Button>
                        </FormActions>
                    </FormRow>
                </FormContainer>

                <svelte:fragment slot="footer">
                    {#if listener}
                        <div class="mt-4 pt-3 border-t border-muted">
                            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <div class="flex items-center">
                                    <span class="font-medium">ID:</span>
                                    <span class="ml-1">{listener.id}</span>
                                </div>
                                <span class="mx-1">•</span>
                                <div class="flex items-center">
                                    <span class="font-medium">Created:</span>
                                    <span class="ml-1">
                                        <RelativeDate 
                                            date={listener.createdAt} 
                                            format="relative" 
                                            showTooltip={true} 
                                            useHoverCard={true} 
                                            iconSize={0}
                                        />
                                    </span>
                                </div>
                                <span class="mx-1">•</span>
                                <div class="flex items-center">
                                    <span class="font-medium">Updated:</span>
                                    <span class="ml-1">
                                        <RelativeDate 
                                            date={listener.updatedAt} 
                                            format="relative" 
                                            showTooltip={true} 
                                            useHoverCard={true} 
                                            iconSize={0}
                                        />
                                    </span>
                                </div>
                                {#if listener.lastSeenAt}
                                    <span class="mx-1">•</span>
                                    <div class="flex items-center">
                                        <span class="font-medium">Last Active:</span>
                                        <span class="ml-1">
                                            <RelativeDate 
                                                date={listener.lastSeenAt} 
                                                format="relative" 
                                                showTooltip={true} 
                                                useHoverCard={true} 
                                                iconSize={0}
                                            />
                                        </span>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </svelte:fragment>
            </FormCard>
        {/if}
    </PageContent>
</PageContainer>
