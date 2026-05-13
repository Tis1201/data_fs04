<script lang="ts">
    import "../app.postcss";
    import { Toaster } from "svelte-sonner";
    import AuthStateHandler from "$lib/components/auth/AuthStateHandler.svelte";

    /** Route params from SvelteKit (avoids "unknown prop 'params'" warning) */
    export let params: Record<string, string> = {};
</script>

<Toaster 
    position="bottom-right"
    toastOptions={{
        duration: 5000, // 5 seconds - more appropriate for notifications
        class: 'font-sans',
        style: 'font-size: 0.875rem; line-height: 1.25rem;',
    }}
    expand={true}
    visibleToasts={3}
    closeButton
    richColors
/>
<AuthStateHandler />
<slot />
