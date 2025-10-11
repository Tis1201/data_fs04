<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { sseStore } from '$lib/stores/sse-store';
    import { browser } from '$app/environment';
    
    // Track the previous authentication state and route
    let previousAuthState: boolean | null = null;
    let previousPath: string | null = null;
    let unsubscribe: () => void;
    
    // Function to handle WebSocket and SSE connections based on auth state
    function handleAuthStateChange(isAuthenticated: boolean, currentPath: string) {
        if (!browser) return;
        
        console.log('[AuthStateHandler] Auth state changed:', { 
            previousAuthState, 
            isAuthenticated,
            previousPath,
            currentPath
        });
        
        const isRouteChange = previousPath !== null && previousPath !== currentPath;
        
        // NOTE: SSE connections are now managed per-component (not globally)
        // Each page that needs SSE creates its own connection using createComponentSSE()
        // This prevents connection pool exhaustion and provides better lifecycle management
        
        /* DISABLED: Global SSE management moved to per-component
        // If auth state changed from logged out to logged in
        if (previousAuthState === false && isAuthenticated === true) {
            console.log('[AuthStateHandler] User logged in, resetting connections');
            // Small delay to ensure auth cookies are set before reconnecting
            setTimeout(() => {
                // Connect to SSE endpoint
                if (sseStore) {
                    console.log('[AuthStateHandler] Connecting to SSE endpoint');
                    sseStore.connect('/api/sse');
                }
            }, 100);
        }
        // If auth state changed from logged in to logged out
        else if (previousAuthState === true && isAuthenticated === false) {
            console.log('[AuthStateHandler] User logged out, disconnecting SSE connection');
            sseStore.disconnect();
        }
        // If we're navigating to a user route and connections are not open
        else if (isAuthenticated && isRouteChange && currentPath.startsWith('/user')) {
            console.log('[AuthStateHandler] Navigating to user route, checking connections');
            // Check SSE connection
            if (sseStore && !sseStore.isConnected) {
                console.log('[AuthStateHandler] SSE not connected, connecting');
                sseStore.connect('/api/sse');
            }
        }
        // If we're authenticated but connections are not open
        else if (isAuthenticated) {
            // Check SSE
            if (sseStore && !sseStore.isConnected) {
                console.log('[AuthStateHandler] Authenticated but SSE not connected, connecting');
                sseStore.connect('/api/sse');
            }
        }
        // If we're not authenticated but connections are open
        else if (!isAuthenticated) {
            if (sseStore && sseStore.isConnected) {
                console.log('[AuthStateHandler] Not authenticated but SSE is connected, disconnecting');
                sseStore.disconnect();
            }
        }
        */
        
        // Update previous state
        previousAuthState = isAuthenticated;
        previousPath = currentPath;
    }
    
    onMount(() => {
        if (!browser) return;
        
        // Initialize previous state
        previousAuthState = !!$page.data.user;
        previousPath = $page.url.pathname;
        
        console.log('[AuthStateHandler] Initial mount', { 
            isAuthenticated: previousAuthState, 
            path: previousPath 
        });
        
        // DISABLED: Initial SSE connection now handled per-component
        /*
        // Initial connection check
        if (previousAuthState && sseStore && !sseStore.isConnected) {
            console.log('[AuthStateHandler] Initial mount: Connecting SSE');
            sseStore.connect('/api/sse');
        }
        */
        
        // Subscribe to page store to detect auth state and route changes
        unsubscribe = page.subscribe(($page) => {
            const isAuthenticated = !!$page.data.user;
            const currentPath = $page.url.pathname;
            handleAuthStateChange(isAuthenticated, currentPath);
        });
        
        // DISABLED: SSE cleanup now handled per-component
        /*
        // Add event listener for page unload (which happens during logout)
        const handleBeforeUnload = () => {
            console.log('[AuthStateHandler] Page unloading, cleaning up');
            sseStore.disconnect();
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        */
        
        // Cleanup function
        return () => {
            if (unsubscribe) unsubscribe();
            console.log('[AuthStateHandler] Unmounted');
        };
    });
</script>

<!-- This is a utility component with no UI -->
