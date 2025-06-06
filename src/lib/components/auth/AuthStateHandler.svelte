<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import { page } from '$app/stores';
    import { socketStore } from '$lib/stores/websocket-store';
    import { browser } from '$app/environment';
    
    // Track the previous authentication state and route
    let previousAuthState: boolean | null = null;
    let previousPath: string | null = null;
    let unsubscribe: () => void;
    
    // Function to handle WebSocket connection based on auth state
    function handleAuthStateChange(isAuthenticated: boolean, currentPath: string) {
        if (!browser) return;
        
        console.log('[AuthStateHandler] Auth state changed:', { 
            previousAuthState, 
            isAuthenticated,
            previousPath,
            currentPath,
            socketStatus: socketStore.status
        });
        
        const isRouteChange = previousPath !== null && previousPath !== currentPath;
        
        // If auth state changed from logged out to logged in
        if (previousAuthState === false && isAuthenticated === true) {
            console.log('[AuthStateHandler] User logged in, resetting WebSocket connection');
            // Small delay to ensure auth cookies are set before reconnecting
            setTimeout(() => {
                socketStore.resetConnection(true); // Force immediate reconnect
            }, 100);
        }
        // If auth state changed from logged in to logged out
        else if (previousAuthState === true && isAuthenticated === false) {
            console.log('[AuthStateHandler] User logged out, disconnecting WebSocket');
            socketStore.disconnect();
        }
        // If we're navigating to a user route and WebSocket is not connected
        else if (isAuthenticated && isRouteChange && currentPath.startsWith('/user')) {
            console.log('[AuthStateHandler] Navigating to user route, checking WebSocket connection');
            if (socketStore.status !== 'OPEN') {
                console.log('[AuthStateHandler] WebSocket not connected, resetting connection');
                socketStore.resetConnection(true); // Force immediate reconnect for user routes
            }
        }
        // If we're authenticated but WebSocket is not connected
        else if (isAuthenticated && socketStore.status !== 'OPEN') {
            console.log('[AuthStateHandler] Authenticated but WebSocket not connected, resetting');
            socketStore.resetConnection(true); // Force immediate reconnect when authenticated
        }
        // If we're not authenticated but WebSocket is connected
        else if (!isAuthenticated && socketStore.status === 'OPEN') {
            console.log('[AuthStateHandler] Not authenticated but WebSocket is connected, disconnecting');
            socketStore.disconnect();
        }
        
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
        
        // Initial connection check
        if (previousAuthState && socketStore.status !== 'OPEN') {
            console.log('[AuthStateHandler] Initial mount: Connecting WebSocket');
            socketStore.resetConnection();
        }
        
        // Subscribe to page store to detect auth state and route changes
        unsubscribe = page.subscribe(($page) => {
            const isAuthenticated = !!$page.data.user;
            const currentPath = $page.url.pathname;
            handleAuthStateChange(isAuthenticated, currentPath);
        });
        
        // Add event listener for page unload (which happens during logout)
        const handleBeforeUnload = () => {
            console.log('[AuthStateHandler] Page unloading, cleaning up');
            socketStore.disconnect();
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // Cleanup function
        return () => {
            if (unsubscribe) unsubscribe();
            window.removeEventListener('beforeunload', handleBeforeUnload);
            console.log('[AuthStateHandler] Unmounted');
        };
    });
</script>

<!-- This is a utility component with no UI -->
