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
    
    // Props for the form component - simple passthrough
    export let form;
    export let errors;
    export let enhance;
    export let submitting;
    export let constraints;
    export let errorMessage;
    
    // Event dispatcher for navigation
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    // Function to go back to the previous step
    function goBack() {
        dispatch('goBack');
    }
</script>

<!-- Step 2: Account Details -->
<FormContainer 
    method="POST" 
    action="?/createAccount" 
    {enhance} 
    novalidate 
    {errorMessage}
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
