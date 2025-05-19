<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    
    // Immediate redirect attempt
    if (browser) {
        // Use a more reliable approach with a small timeout
        setTimeout(() => {
            window.location.href = "/user/dashboard";
        }, 100);
    }
</script>

<div class="flex items-center justify-center h-full min-h-screen">
    <p class="text-lg">Redirecting to dashboard...</p>
</div>
