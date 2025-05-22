<script lang="ts">
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedPasswordInput from "$lib/components/ui_components_sveltekit/form/EnhancedPasswordInput.svelte";
    import { Input } from "$lib/components/ui/input";
    
    export let emailSettings: any;
</script>

<h3 class="text font-medium mt-6 mb-4">Resend API Configuration</h3>

<FormRow columns={1}>
    <FormField 
        id="apiKey" 
        label="API Key (leave blank to keep current)" 
    >
        <EnhancedPasswordInput 
            id="apiKey" 
            name="apiKey" 
            placeholder="••••••••"
        />
    </FormField>
</FormRow>