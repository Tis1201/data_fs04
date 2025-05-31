<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { socketStore } from '$lib/stores/websocket-store';
    import { browser } from '$app/environment';
    
    // Track the previous authentication state
    let previousAuthState: boolean | null = null;
    let unsubscribe: () => void;
    
    // Function to handle WebSocket connection based on auth state
    function handleAuthStateChange(isAuthenticated: boolean) {
        if (browser) {
            // If auth state changed from logged out to logged in
            if (previousAuthState === false && isAuthenticated === true) {
                console.log('User logged in, resetting WebSocket connection');
                socketStore.resetConnection();
            }
            
            // If auth state changed from logged in to logged out
            if (previousAuthState === true && isAuthenticated === false) {
                console.log('User logged out, disconnecting WebSocket');
                socketStore.disconnect();
            }
            
            // Update previous state
            previousAuthState = isAuthenticated;
        }
    }
    
    onMount(() => {
        if (browser) {
            // Initialize previous state
            previousAuthState = !!$page.data.user;
            
            // Subscribe to page store to detect auth state changes
            unsubscribe = page.subscribe(($page) => {
                const isAuthenticated = !!$page.data.user;
                handleAuthStateChange(isAuthenticated);
            });
            
            // Add event listener for page unload (which happens during logout)
            window.addEventListener('beforeunload', () => {
                // Disconnect WebSocket on page unload
                socketStore.disconnect();
            });
        }
    });
    
    onDestroy(() => {
        if (unsubscribe) unsubscribe();
        if (browser) {
            window.removeEventListener('beforeunload', () => {
                socketStore.disconnect();
            });
        }
    });
</script>

<!-- This is a utility component with no UI -->
