<script lang="ts">
    import "../app.postcss";
    import { Toaster } from "svelte-sonner";
</script>

<Toaster 
    position="top-center"
    toastOptions={{
        duration: 10000, // 10 seconds
        class: 'font-sans',
        style: 'font-size: 0.875rem; line-height: 1.25rem;',
    }}
    expand={true}
    visibleToasts={3}
    closeButton
    richColors
/>
<slot />
