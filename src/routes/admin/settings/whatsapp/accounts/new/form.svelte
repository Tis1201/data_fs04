<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { Plus } from "lucide-svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import { socketStore } from "$lib/stores/websocket-store";
    import { type ClientMessage, createClientMessage, type MessageScope } from "$lib/types/messages";
    import { writable } from 'svelte/store';
    
    // Props for the form component
    export let form;
    export let errors;
    export let enhance;
    export let submitting;
    export let constraints;
    export let errorMessage;
    
    // Event dispatcher for navigation
    import { createEventDispatcher, onMount } from 'svelte';
    const dispatch = createEventDispatcher();
    
    // Create a local error message store
    const localErrorMessage = writable(errorMessage);
    
    // Update the local store when the prop changes
    $: localErrorMessage.set(errorMessage);
    
    // Create a custom enhance function that wraps the provided one
    const customEnhance = (originalEnhance) => {
        return (form) => {
            return ({ formData, formElement, action, cancel }) => {
                console.log('[WHATSAPP_FORM_COMPONENT] Form submission started');
                
                // Validate client ID before submission
                const clientIdInput = formElement.querySelector('#client_id');
                const clientId = clientIdInput?.value || '';
                const isValidClientId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId);
                
                console.log('[WHATSAPP_FORM_COMPONENT] Client ID validation:', { clientId, isValidClientId });
                
                if (!isValidClientId) {
                    console.warn('[WHATSAPP_FORM_COMPONENT] Invalid client ID format:', clientId);
                    localErrorMessage.set('Invalid client ID format. Please reconnect your WhatsApp account.');
                    cancel();
                    return;
                }
                
                // Log form data for debugging
                console.log('[WHATSAPP_FORM_COMPONENT] Form data:', {
                    clientId: formData.get('client_id'),
                    description: formData.get('description')
                });
                
                // If valid, proceed with the original enhance function
                if (originalEnhance) {
                    console.log('[WHATSAPP_FORM_COMPONENT] Proceeding with form submission');
                    return originalEnhance(form)({ formData, formElement, action, cancel });
                }
            };
        };
    };
    
    // Function to go back to the previous step
    function goBack() {
        dispatch('goBack');
    }
</script>

<!-- Step 2: Account Details -->
<FormContainer 
    method="POST" 
    action="?/createAccount" 
    enhance={customEnhance(enhance)} 
    novalidate 
    errorMessage={$localErrorMessage}
>
    <FormCard title="Account Details" description="Enter account information.">

        <FormRow columns={1}>
            <FormField id="client_id" label="Client ID" error={errors.client_id}>
                <Input
                    id="client_id"
                    name="client_id"
                    bind:value={form.client_id}
                    readonly
                    aria-invalid={errors.client_id ? 'true' : undefined}
                    {...constraints.client_id}
                />
            </FormField>
        </FormRow>
        
        

        <FormRow columns={1}>
            <FormField id="name" label="Display Name" error={errors.name}>
                <Input
                    id="name"
                    name="name"
                    readonly
                    bind:value={form.name}
                    placeholder="Display name from WhatsApp"
                    aria-invalid={errors.name ? 'true' : undefined}
                    {...constraints.name}
                />
            </FormField>
        </FormRow>
        
        <FormRow columns={1}>
            <FormField id="phoneNumber" label="Phone Number" error={errors.phoneNumber}>
                <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    readonly
                    bind:value={form.phoneNumber}
                    placeholder="Phone number from WhatsApp"
                    aria-invalid={errors.phoneNumber ? 'true' : undefined}
                    {...constraints.phoneNumber}
                />
            </FormField>
        </FormRow>

        <FormRow columns={1}>
            <FormField id="description" label="Description" error={errors.description}>
                <Textarea
                    id="description"
                    name="description"
                    bind:value={form.description}
                    placeholder="Describe this WhatsApp account"
                    aria-invalid={errors.description ? 'true' : undefined}
                    {...constraints.description}
                />
            </FormField>
        </FormRow>
        
      

        <FormActions>
            <Button
                type="button"
                variant="outline"
                on:click={goBack}
                disabled={submitting}
            >
                Back
            </Button>
            <Button type="submit" disabled={submitting} class="min-w-[120px] relative">
                {#if submitting}
                    <span class="absolute inset-0 flex items-center justify-center">
                        <Skeleton class="h-4 w-20" />
                    </span>
                    <span class="opacity-0">Create Account</span>
                {:else}
                    <Plus class="h-4 w-4 mr-2" />
                    Create Account
                {/if}
            </Button>
        </FormActions>
    </FormCard>
</FormContainer>
