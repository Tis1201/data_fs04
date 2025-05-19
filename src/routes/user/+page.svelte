<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    
    onMount(() => {
        // Redirect to dashboard on the main user path
        goto("/user/dashboard");
    });
</script>

<div class="flex items-center justify-center h-full">
    <p>Redirecting to dashboard...</p>
</div>
