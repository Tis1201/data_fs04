<script lang="ts">
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import EnhancedPasswordInput from "$lib/components/ui_components_sveltekit/form/EnhancedPasswordInput.svelte";
    import EnhancedCheckbox from "$lib/components/ui_components_sveltekit/form/EnhancedCheckbox.svelte";
    import { Input } from "$lib/components/ui/input";
    
    export let emailSettings: any;
</script>

<h3 class="text font-medium mt-6 mb-4">SMTP Configuration</h3>

<FormRow columns={2}>
    <FormField 
        id="host" 
        label="SMTP Host" 
    >
        <Input 
            id="host" 
            name="host" 
            value={emailSettings.smtpHost}
            placeholder="smtp.example.com"
            required
        />
    </FormField>
    
    <FormField 
        id="port" 
        label="SMTP Port" 
    >
        <Input 
            id="port" 
            name="port" 
            type="number"
            value={emailSettings.smtpPort}
            placeholder="587"
            required
        />
    </FormField>
</FormRow>

<FormRow columns={2}>
    <FormField 
        id="username" 
        label="Username" 
    >
        <Input 
            id="username" 
            name="username" 
            value={emailSettings.smtpUser}
            placeholder="username@example.com"
            required
        />
    </FormField>
    
    <FormField 
        id="password" 
        label="Password (leave blank to keep current)" 
    >
        <EnhancedPasswordInput 
            id="password" 
            name="password" 
            placeholder="••••••••"
        />
    </FormField>
</FormRow>

<FormRow columns={1}>
    <FormField 
        id="secure" 
        label="" 
    >
        <EnhancedCheckbox
            id="secure"
            name="secure"
            checked={emailSettings.smtpSecure}
            label="Use SSL/TLS"
        />
    </FormField>
</FormRow>