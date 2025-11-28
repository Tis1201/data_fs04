<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { mqttStore } from '$lib/stores/mqtt-store';
    import { browser } from '$app/environment';
    
    // Track the previous authentication state and route
    let previousAuthState: boolean | null = null;
    let previousPath: string | null = null;
    let unsubscribe: () => void;
    let isInitializing = false; // Flag to prevent duplicate connections during mount
    
    // Function to handle MQTT connections based on auth state
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
                mqttStore.setAuthEnabled?.(false);
                mqttStore.disconnect();
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
                mqttStore.setAuthEnabled?.(true);
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
            console.log('[AuthStateHandler] User logged out, force disconnecting MQTT connection');
            // Force immediate disconnection of MQTT connection
            try {
                mqttStore.setAuthEnabled?.(false);
                mqttStore.disconnect();
            } catch (err) {
                console.warn('[AuthStateHandler] Error disconnecting MQTT store:', err);
            }
            
            // Additional cleanup
            try {
                if (mqttStore.resetForNewUser) {
                    mqttStore.resetForNewUser?.();
                }
            } catch (err) {
                console.warn('[AuthStateHandler] Error resetting MQTT store:', err);
            }
            
            console.log('[AuthStateHandler] MQTT connection forcefully closed on logout');
        }
        // If we're not authenticated but connections are open
        else if (!isAuthenticated) {
            console.log('[AuthStateHandler] Not authenticated, ensuring MQTT connection is closed');
            try {
                mqttStore.setAuthEnabled?.(false);
                console.log('[AuthStateHandler] Force closing MQTT connection');
                mqttStore.disconnect();
                if (mqttStore.resetForNewUser) {
                    mqttStore.resetForNewUser?.();
                }
            } catch (err) {
                console.warn('[AuthStateHandler] Error during MQTT cleanup:', err);
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
            mqttStore.setAuthEnabled?.(true);
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
                mqttStore.setAuthEnabled?.(false);
            }
            handleAuthStateChange(isAuthenticated, currentPath);
        });
        
        // Add event listener for page unload (which happens during logout)
        const handleBeforeUnload = () => {
            console.log('[AuthStateHandler] Page unloading, cleaning up MQTT');
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
