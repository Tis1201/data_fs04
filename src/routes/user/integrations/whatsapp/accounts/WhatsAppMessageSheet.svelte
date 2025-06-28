<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { enhance } from '$app/forms';
    import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
    import { Button } from '$lib/components/ui/button';
    import { Textarea } from '$lib/components/ui/textarea';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Loader2 } from 'lucide-svelte';
    import { superForm } from 'sveltekit-superforms/client';
    import { z } from 'zod';
    import { toast } from 'svelte-sonner';
    
    // Define props
    export let accountId: string;
    export let open = false;
    export let data; // Add data prop to receive form data from the parent
    
    // Create event dispatcher
    const dispatch = createEventDispatcher();
    
    // Define the form schema
    const schema = z.object({
        to: z.string().min(1, { message: 'Phone number is required' }),
        message: z.string().min(1, { message: 'Message is required' })
    });
    
    // Create the form
    const { form, errors, enhance: superEnhance, submitting, reset } = superForm(data, {
        id: 'whatsapp-message',
        validators: schema,
        dataType: 'json',
        resetForm: true,
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('Message sent successfully');
                dispatch('sent');
            } else if (result.type === 'error') {
                toast.error(result.error?.message || 'Failed to send message');
            }
        }
    });
    
    // Handle close
    function handleClose() {
        reset();
        dispatch('close');
    }
</script>

<Sheet bind:open onClose={handleClose}>
    <SheetContent>
        <SheetHeader>
            <SheetTitle>Send WhatsApp Message</SheetTitle>
            <SheetDescription>
                Send a message through your WhatsApp account
            </SheetDescription>
        </SheetHeader>
        
        <div class="space-y-4 mt-6">
            <form 
                method="POST" 
                action="?/sendMessage" 
                class="space-y-4" 
                use:superEnhance
            >
                <input type="hidden" name="accountId" value={accountId} />
                
                <div class="space-y-2">
                    <Label for="to">To (Phone Number)</Label>
                    <Input 
                        id="to" 
                        name="to" 
                        placeholder="+1234567890" 
                        bind:value={$form.to} 
                        class={$errors.to ? 'border-destructive' : ''}
                    />
                    {#if $errors.to}
                        <p class="text-destructive text-sm">{$errors.to}</p>
                    {/if}
                </div>
                
                <div class="space-y-2">
                    <Label for="message">Message</Label>
                    <Textarea 
                        id="message" 
                        name="message" 
                        placeholder="Type your message here..." 
                        rows={5}
                        bind:value={$form.message}
                        class={$errors.message ? 'border-destructive' : ''}
                    />
                    {#if $errors.message}
                        <p class="text-destructive text-sm">{$errors.message}</p>
                    {/if}
                </div>
                
                <div class="flex justify-end gap-2">
                    <Button type="button" variant="outline" on:click={handleClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={$submitting}>
                        {#if $submitting}
                            <Loader2 class="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                        {:else}
                            Send Message
                        {/if}
                    </Button>
                </div>
            </form>
        </div>
    </SheetContent>
</Sheet>
