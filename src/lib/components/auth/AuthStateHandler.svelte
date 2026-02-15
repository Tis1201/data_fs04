<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { mqttClient } from '$lib/client/mqtt/mqttClient';
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
        
        const isAuthChange = previousAuthState !== isAuthenticated;
        const isRouteChange = previousPath !== null && previousPath !== currentPath;
        
        // Skip if nothing actually changed (e.g. data invalidation on same page)
        // Initial MQTT connection is already handled in onMount
        if (!isAuthChange && !isRouteChange) {
            previousAuthState = isAuthenticated;
            previousPath = currentPath;
            return;
        }
        
        console.log('[AuthStateHandler] Auth state changed:', {
            previousAuthState,
            isAuthenticated,
            previousPath,
            currentPath
        });
        
        // CRITICAL: Force disconnect if navigating to auth pages (logout/login)
        if (currentPath.startsWith('/auth/login') || currentPath.startsWith('/auth/logout')) {
            console.log('[AuthStateHandler] Navigating to auth page, FORCE CLOSING MQTT connection');
            try {
                // Disconnect MQTT client
                mqttClient.setAuthState('unauthenticated');
                mqttClient.disconnect(true);
            } catch (err) {
                console.error('[AuthStateHandler] Error force closing MQTT connection:', err);
            }
            previousAuthState = false;
            previousPath = currentPath;
            return; // Exit early
        }
        
        // If auth state changed from logged out to logged in
        if (previousAuthState === false && isAuthenticated === true) {
            console.log('[AuthStateHandler] User logged in, connecting MQTT');
            // Small delay to ensure auth cookies are set before connecting
            setTimeout(() => {
                // Connect MQTT client
                mqttClient.setAuthState('authenticated');
                mqttClient.connect().catch(err => {
                    console.warn('[AuthStateHandler] MQTT connect failed:', err);
                });
            }, 100);
        }
        // If auth state changed from logged in to logged out
        else if (previousAuthState === true && isAuthenticated === false) {
            console.log('[AuthStateHandler] User logged out, force disconnecting MQTT connection');
            // Force immediate disconnection
            try {
                mqttClient.setAuthState('unauthenticated');
                mqttClient.disconnect(true);
            } catch (err) {
                console.warn('[AuthStateHandler] Error disconnecting MQTT:', err);
            }
            
            console.log('[AuthStateHandler] MQTT connection forcefully closed on logout');
        }
        // If we're navigating to a user route and MQTT is not connected
        else if (isAuthenticated && isRouteChange && currentPath.startsWith('/user')) {
            console.log('[AuthStateHandler] Navigating to user route, checking MQTT connection');
            // Check MQTT connection
            mqttClient.setAuthState('authenticated');
            mqttClient.connect().catch(err => {
                console.warn('[AuthStateHandler] MQTT connect failed:', err);
            });
        }
        // If we're authenticated but MQTT is not connected
        else if (isAuthenticated) {
            // Check MQTT connection (connect() already checks if connected)
            mqttClient.setAuthState('authenticated');
            mqttClient.connect().catch(err => {
                console.warn('[AuthStateHandler] MQTT connect failed:', err);
            });
        }
        // If we're not authenticated but MQTT is connected
        else if (!isAuthenticated) {
            console.log('[AuthStateHandler] Not authenticated, ensuring MQTT connection is closed');
            try {
                // Disconnect MQTT client
                mqttClient.setAuthState('unauthenticated');
                mqttClient.disconnect(true);
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
            console.log('[AuthStateHandler] Initial mount: Connecting MQTT with authenticated user');
            
            // Initialize MQTT client for authenticated user
            mqttClient.setAuthState('authenticated');
            mqttClient.connect().catch(err => {
                console.warn('[AuthStateHandler] MQTT connect failed:', err);
            });
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
            handleAuthStateChange(isAuthenticated, currentPath);
        });
        
        // Cleanup function
        return () => {
            if (unsubscribe) unsubscribe();
            console.log('[AuthStateHandler] Unmounted');
        };
    });
</script>

<!-- This is a utility component with no UI -->
