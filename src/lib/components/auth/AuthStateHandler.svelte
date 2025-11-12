<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { sseStore } from '$lib/stores/sse-store';
    import { socketStore } from '$lib/stores/websocket-store';
    import { mqttStore } from '$lib/stores/mqtt-store';
    import { browser } from '$app/environment';
    
    // Track the previous authentication state and route
    let previousAuthState: boolean | null = null;
    let previousPath: string | null = null;
    let unsubscribe: () => void;
    let isInitializing = false; // Flag to prevent duplicate connections during mount
    
    // Function to handle WebSocket and SSE connections based on auth state
    function handleAuthStateChange(isAuthenticated: boolean, currentPath: string) {
        if (!browser) return;
        
        // Skip if we're still initializing to prevent duplicate connections
        if (isInitializing) {
            console.log('[AuthStateHandler] Skipping auth state change during initialization');
            return;
        }
        
        console.log('[AuthStateHandler] Auth state changed:', { 
            previousAuthState, 
            isAuthenticated,
            previousPath,
            currentPath
        });
        
        const isRouteChange = previousPath !== null && previousPath !== currentPath;
        
        // CRITICAL: Force disconnect if navigating to auth pages (logout/login)
        if (currentPath.startsWith('/auth/login') || currentPath.startsWith('/auth/logout')) {
            console.log('[AuthStateHandler] Navigating to auth page, FORCE CLOSING all connections');
            try {
                socketStore.setAuthEnabled?.(false);
                sseStore.setAuthEnabled?.(false);
                mqttStore.setAuthEnabled?.(false);
                sseStore.disconnect();
                socketStore.disconnect();
                mqttStore.disconnect();
                sseStore.resetForNewUser?.();
                socketStore.resetForNewUser?.();
                mqttStore.resetForNewUser?.();
            } catch (err) {
                console.error('[AuthStateHandler] Error force closing connections:', err);
            }
            previousAuthState = false;
            previousPath = currentPath;
            return; // Exit early
        }
        
        // If auth state changed from logged out to logged in
        if (previousAuthState === false && isAuthenticated === true) {
            console.log('[AuthStateHandler] User logged in, resetting connections');
            // Small delay to ensure auth cookies are set before reconnecting
            setTimeout(() => {
                socketStore.setAuthEnabled?.(true);
                sseStore.setAuthEnabled?.(true);
                mqttStore.setAuthEnabled?.(true);
                // Reset WebSocket connection with new session
                if (socketStore) {
                    console.log('[AuthStateHandler] Resetting WebSocket connection');
                    socketStore.resetForNewUser?.();
                }
                // Reset SSE connection with new session
                if (sseStore) {
                    console.log('[AuthStateHandler] Resetting SSE connection');
                    sseStore.resetForNewUser?.();
                    // Reconnect after reset
                    setTimeout(() => {
                        sseStore.connect('/api/sse');
                    }, 50);
                }
                if (mqttStore) {
                    console.log('[AuthStateHandler] Resetting MQTT connection');
                    mqttStore.resetForNewUser();
                    setTimeout(() => {
                        mqttStore.connect?.();
                    }, 50);
                }
            }, 100);
        }
        // If auth state changed from logged in to logged out
        else if (previousAuthState === true && isAuthenticated === false) {
            console.log('[AuthStateHandler] User logged out, force disconnecting ALL connections');
            // Force immediate disconnection of ALL connections
            try {
                socketStore.setAuthEnabled?.(false);
                sseStore.setAuthEnabled?.(false);
                mqttStore.setAuthEnabled?.(false);
                sseStore.disconnect();
                socketStore.disconnect();
                mqttStore.disconnect();
            } catch (err) {
                console.warn('[AuthStateHandler] Error disconnecting stores:', err);
            }
            
            // Additional cleanup - force close any lingering connections
            try {
                if (sseStore.resetForNewUser) {
                    sseStore.resetForNewUser?.();
                }
                if (socketStore.resetForNewUser) {
                    socketStore.resetForNewUser?.();
                }
                if (mqttStore.resetForNewUser) {
                    mqttStore.resetForNewUser?.();
                }
            } catch (err) {
                console.warn('[AuthStateHandler] Error resetting stores:', err);
            }
            
            console.log('[AuthStateHandler] All connections forcefully closed on logout');
        }
        // If we're navigating to a user route and connections are not open
        else if (isAuthenticated && isRouteChange && currentPath.startsWith('/user')) {
            console.log('[AuthStateHandler] Navigating to user route, checking connections');
            // Check WebSocket connection
            if (socketStore && socketStore.status !== 'OPEN') {
                console.log('[AuthStateHandler] WebSocket not connected, resetting');
                socketStore.resetForNewUser();
            }
            // Check SSE connection
            if (sseStore && !sseStore.isConnected) {
                console.log('[AuthStateHandler] SSE not connected, resetting');
                sseStore.resetForNewUser();
                setTimeout(() => {
                    sseStore.connect('/api/sse');
                }, 50);
            }
        }
        // If we're authenticated but connections are not open
        else if (isAuthenticated) {
            // Check WebSocket
            if (socketStore && socketStore.status !== 'OPEN') {
                console.log('[AuthStateHandler] Authenticated but WebSocket not connected, resetting');
                socketStore.resetForNewUser();
            }
            // Check SSE
            if (sseStore && !sseStore.isConnected) {
                console.log('[AuthStateHandler] Authenticated but SSE not connected, resetting');
                sseStore.resetForNewUser();
                setTimeout(() => {
                    sseStore.connect('/api/sse');
                }, 50);
            }
        }
        // If we're not authenticated but connections are open
        else if (!isAuthenticated) {
            console.log('[AuthStateHandler] Not authenticated, ensuring all connections are closed');
            try {
                socketStore.setAuthEnabled?.(false);
                sseStore.setAuthEnabled?.(false);
                mqttStore.setAuthEnabled?.(false);
                if (socketStore && socketStore.status === 'OPEN') {
                    console.log('[AuthStateHandler] Force closing WebSocket connection');
                    socketStore.disconnect();
                }
                if (sseStore && sseStore.isConnected) {
                    console.log('[AuthStateHandler] Force closing SSE connection');
                    sseStore.disconnect();
                }
                console.log('[AuthStateHandler] Force closing MQTT connection');
                mqttStore.disconnect();
                
                // Additional cleanup to ensure no lingering connections
                if (sseStore.resetForNewUser) {
                    sseStore.resetForNewUser?.();
                }
                if (socketStore.resetForNewUser) {
                    socketStore.resetForNewUser?.();
                }
                if (mqttStore.resetForNewUser) {
                    mqttStore.resetForNewUser?.();
                }
            } catch (err) {
                console.warn('[AuthStateHandler] Error during cleanup:', err);
            }
        }
        
        // Update previous state
        previousAuthState = isAuthenticated;
        previousPath = currentPath;
    }
    
    onMount(() => {
        if (!browser) return;
        
        // Set initialization flag to prevent duplicate connections
        isInitializing = true;
        
        // Initialize previous state
        previousAuthState = !!$page.data.user;
        previousPath = $page.url.pathname;
        
        console.log('[AuthStateHandler] Initial mount', { 
            isAuthenticated: previousAuthState, 
            path: previousPath 
        });
        
        // Initial connection check
        if (previousAuthState) {
            console.log('[AuthStateHandler] Initial mount: Connecting with authenticated user');
            socketStore.setAuthEnabled?.(true);
            sseStore.setAuthEnabled?.(true);
            mqttStore.setAuthEnabled?.(true);
            // Reset WebSocket connection to ensure fresh session
            if (socketStore) {
                socketStore.resetForNewUser();
            }
            // Reset and connect SSE to ensure fresh session
            if (sseStore) {
                sseStore.resetForNewUser();
                setTimeout(() => {
                    sseStore.connect('/api/sse');
                }, 50);
            }
            if (mqttStore) {
                mqttStore.resetForNewUser();
                setTimeout(() => {
                    mqttStore.connect?.();
                }, 50);
            }
        }
        
        // Clear initialization flag after connections are established
        setTimeout(() => {
            isInitializing = false;
            console.log('[AuthStateHandler] Initialization complete');
        }, 200);
        
        // Subscribe to page store to detect auth state and route changes
        unsubscribe = page.subscribe(($page) => {
            const isAuthenticated = !!$page.data.user;
            const currentPath = $page.url.pathname;
            if (!isAuthenticated) {
                socketStore.setAuthEnabled?.(false);
                sseStore.setAuthEnabled?.(false);
                mqttStore.setAuthEnabled?.(false);
            }
            handleAuthStateChange(isAuthenticated, currentPath);
        });
        
        // Add event listener for page unload (which happens during logout)
        const handleBeforeUnload = () => {
            console.log('[AuthStateHandler] Page unloading, cleaning up');
            sseStore.disconnect();
            socketStore.disconnect();
            mqttStore.disconnect();
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
