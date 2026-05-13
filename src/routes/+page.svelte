<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    
    // This page should never actually render due to server-side redirects
    // But just in case, we'll add a client-side fallback
    onMount(() => {
        // If we somehow reach this page, redirect to login
        goto('/auth/login');
    });
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-gray-600">Redirecting...</p>
    </div>
</div>
