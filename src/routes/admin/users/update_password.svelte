<script lang="ts">
    import { enhance } from "$app/forms";
    import { toast } from "svelte-sonner";
    import type { User } from "@prisma/client";
    
    // Props
    export let user: User | null = null;
    export let onSuccess: (() => void) | null = null;
    export let onComplete: (() => void) | null = null;
    
    // Local state
    let isSubmitting = false;
    let form: HTMLFormElement;
    
    // Submit the form programmatically
    export function submit() {
        if (form) {
            form.requestSubmit();
        }
    }
</script>

{#if user}
    <form
        bind:this={form}
        method="POST"
        action="?/updatePassword"
        use:enhance={({ formData }) => {
            isSubmitting = true;
            
            return async ({ result, update }) => {
                isSubmitting = false;
                
                if (result.type === 'success') {
                    toast.success(`Password updated successfully for ${user.email}`);
                    if (onSuccess) onSuccess();
                } else if (result.type === 'failure') {
                    toast.error(`Failed to update password: ${result.data?.message || 'Unknown error'}`);
                }
                
                // Always call onComplete regardless of result
                if (onComplete) onComplete();
            };
        }}
    >
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="password" value={formData?.password || ''} />
        <button type="submit" class="hidden">Submit</button>
    </form>
{/if}
