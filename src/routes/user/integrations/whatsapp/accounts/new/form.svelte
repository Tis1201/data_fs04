<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Button } from "$lib/components/ui/button";
    import { ArrowLeft } from "lucide-svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import type { SuperValidated } from "sveltekit-superforms";
    import type { CreateWhatsAppAccountSchema } from "./schema";
    
    export let form: SuperValidated<CreateWhatsAppAccountSchema>;
    export let errors: Record<string, string>;
    export let enhance: any;
    export let submitting: boolean;
    export let constraints: any;
    export let errorMessage: string | null;
    
    const dispatch = createEventDispatcher();
    
    function goBack() {
        dispatch('goBack');
    }
</script>

<FormCard 
    title="WhatsApp Account Details" 
    description="Enter details for your new WhatsApp account."
>
    <form method="POST" action="?/createAccount" use:enhance>
        <!-- Hidden field for client ID -->
        <input type="hidden" name="client_id" value={form.client_id} />
        <input type="hidden" name="name" value={form.name || ""} />
        <input type="hidden" name="phoneNumber" value={form.phoneNumber || ""} />
        
        <div class="space-y-4">
            <!-- Display account info if available -->
            {#if form.name || form.phoneNumber}
                <div class="bg-muted/40 p-4 rounded-lg border border-muted mb-4">
                    <h4 class="text-sm font-medium mb-2">Connected WhatsApp Account</h4>
                    <div class="space-y-2">
                        {#if form.name}
                            <div>
                                <p class="text-xs text-muted-foreground">Name</p>
                                <p class="text-sm">{form.name}</p>
                            </div>
                        {/if}
                        {#if form.phoneNumber}
                            <div>
                                <p class="text-xs text-muted-foreground">Phone Number</p>
                                <p class="text-sm">{form.phoneNumber}</p>
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}
            
            <!-- Description field -->
            <FormField
                name="description"
                label="Description"
                required={true}
                error={errors?.description}
            >
                <Textarea
                    name="description"
                    placeholder="Enter a description for this WhatsApp account"
                    value={form.description || ""}
                    required
                    disabled={submitting}
                />
            </FormField>
            
            <!-- Error message -->
            {#if errorMessage}
                <div class="text-sm text-destructive">{errorMessage}</div>
            {/if}
            
            <!-- Form actions -->
            <FormActions>
                <Button
                    type="button"
                    variant="outline"
                    on:click={goBack}
                    disabled={submitting}
                >
                    <ArrowLeft class="h-4 w-4 mr-2" />
                    Back
                </Button>
                
                <Button
                    type="submit"
                    variant="default"
                    disabled={submitting}
                >
                    {#if submitting}
                        Creating...
                    {:else}
                        Create Account
                    {/if}
                </Button>
            </FormActions>
        </div>
    </form>
</FormCard>
