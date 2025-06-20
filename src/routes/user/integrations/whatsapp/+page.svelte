<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    
    onMount(() => {
        // Redirect to accounts page
        goto("/user/integrations/whatsapp/accounts");
    });
</script>

<div class="flex items-center justify-center h-full">
    <div class="animate-pulse text-muted-foreground">Redirecting to WhatsApp accounts...</div>
</div>
