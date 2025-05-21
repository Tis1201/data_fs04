<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { EmailServiceProvider } from '@prisma/client';
    import { Input } from '$lib/components/ui/input';
    import { Button } from '$lib/components/ui/button';
    import { Mail } from 'lucide-svelte';
    
    // Import form components
    import FormContainer from '$lib/components/ui_components_sveltekit/form/FormContainer.svelte';
    import FormField from '$lib/components/ui_components_sveltekit/form/FormField.svelte';
    import FormRow from '$lib/components/ui_components_sveltekit/form/FormRow.svelte';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';

    // Props
    export let provider: EmailServiceProvider;
    export let onClose: () => void = () => {};
    
    // Default values
    const defaultSubject = "Test Email from Email Service Provider";
    const defaultMessage = "This is a test email to verify the email service provider configuration.";
    
    // Event dispatcher
    const dispatch = createEventDispatcher();
    
    // Track success state for visual feedback
    let showSuccessMessage = false;
    
    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler({
        id: provider.id,
        to: "",
        subject: defaultSubject,
        message: defaultMessage
    }, {
        validateOnInput: true,
        validators: {
            to: (value) => {
                if (!value) return "Recipient email is required";
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email address";
                return true;
            }
        },
        // Don't show form-level errors when we have field-level errors
        onError: (error) => {
            // If we have field validation errors, don't show the form-level error
            if (Object.values($errors).some(err => err)) {
                return { type: 'error', text: '' }; // Return empty error to suppress form-level message
            }
            return null; // Let the default handler handle other errors
        },
        onSuccess: () => {
            // Show success message and delay closing the sheet
            showSuccessMessage = true;
            
            // Close the sheet after a delay to show the success message
            setTimeout(() => {
                dispatch('success');
                onClose();
            }, 1500); // 1.5 second delay
        }
    });
</script>

<FormContainer
    method="POST"
    action="?/testEmailSend"
    {enhance}
    errorMessage={$errorMessage}
    showToasts={false}
>
    <div class="space-y-6">
        <input type="hidden" name="id" value={$form.id} />
        
        <AdminCard
            title="Send Test Email"
            description="Send a test email using {provider.name}"
            icon={Mail}
            compact={true}
        >
            <div class="space-y-6">
                <FormRow columns={1}>
                    <FormField 
                        id="to" 
                        label="Recipient Email" 
                        error={$errors.to}
                        description="The email address where the test message will be sent"
                        required={true}
                    >
                        <Input 
                            id="to" 
                            name="to"
                            type="email" 
                            placeholder="Enter recipient email" 
                            bind:value={$form.to}
                            aria-invalid={$errors.to ? 'true' : undefined}
                            {...$constraints.to}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField 
                        id="subject" 
                        label="Subject" 
                        error={$errors.subject}
                        description="The subject line of the test email"
                        required={true}
                    >
                        <Input 
                            id="subject" 
                            name="subject"
                            type="text" 
                            bind:value={$form.subject}
                            aria-invalid={$errors.subject ? 'true' : undefined}
                            {...$constraints.subject}
                        />
                    </FormField>
                </FormRow>
                
                <FormRow columns={1}>
                    <FormField 
                        id="message" 
                        label="Message" 
                        error={$errors.message}
                        description="The content of the test email message"
                        required={true}
                    >
                        <textarea 
                            id="message" 
                            name="message"
                            class="w-full min-h-[100px] p-2 border rounded-md" 
                            bind:value={$form.message}
                            aria-invalid={$errors.message ? 'true' : undefined}
                            {...$constraints.message}
                        ></textarea>
                    </FormField>
                </FormRow>
                
                {#if showSuccessMessage}
                    <div class="p-3 text-sm text-green-500 bg-green-50 rounded-md animate-pulse">
                        Test email sent successfully! Closing...
                    </div>
                {/if}
                
                <div class="flex justify-between w-full">
                    <Button type="button" variant="outline" on:click={onClose} disabled={showSuccessMessage}>Cancel</Button>
                    <Button 
                        type="submit"
                        disabled={$submitting || showSuccessMessage}
                        variant={showSuccessMessage ? 'success' : 'default'}
                    >
                        {#if $submitting}
                            Sending...
                        {:else if showSuccessMessage}
                            Sent Successfully ✓
                        {:else}
                            Send Test Email
                        {/if}
                    </Button>
                </div>
            </div>
        </AdminCard>
    </div>
</FormContainer>
