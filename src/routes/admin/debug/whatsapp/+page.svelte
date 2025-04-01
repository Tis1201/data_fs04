<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { ArrowLeft, RefreshCw, CheckCircle, Plus, QrCode, AlertTriangle } from "lucide-svelte";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import { whatsAppStore } from "$lib/stores/whatsapp-store";
    import type { ConnectionStatus } from "$lib/stores/whatsapp-store";
    import type { PageData } from './$types';
    import { writable, derived } from 'svelte/store';
    import { onDestroy } from 'svelte';
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    export let data: PageData;
    const title = "Debug WhatsApp Account";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
       "Debug",
        "Whatsapp Account",
    ];
    
    // Track the current step in the account creation process
    let currentStep = 1; // 1: Connect WhatsApp, 2: Account Details, 3: Success
    
    // Account data after creation
    let createdAccount: { id?: string; description: string } | null = null;
    
    
    // Subscribe to the WhatsApp store to update our form state
    const unsubscribe = whatsAppStore.subscribe($store => {
        // Log for debugging
        console.log('WhatsApp store updated:', {
            storeClientId: $store.clientId,
            storeQrCode: $store.qrCode ? 'present' : 'null',
            storeConnectionStatus: $store.connectionStatus,
            storePushName: $store.pushName,
            storePhoneNumber: $store.phoneNumber
        });
        
        
    });
    
    // Clean up subscription when component is destroyed
    onDestroy(unsubscribe);
    
    // Loading state
    let isRefreshing = false;
    
    // Function to refresh messages
    async function refreshMessages() {
        if (isRefreshing) return;
        
        isRefreshing = true;
        try {
            // Reset the store to trigger a refresh
            whatsAppStore.reset();
            toast.success("Messages refreshed");
        } catch (error) {
            console.error("Error refreshing messages:", error);
            toast.error("Failed to refresh messages");
        } finally {
            // Add a slight delay to make the loading state visible
            setTimeout(() => {
                isRefreshing = false;
            }, 500);
        }
    }
    
    // Function to send a test message
    async function sendTestMessage() {
        try {
            // Get the current client ID from the store
            const clientId = $whatsAppStore?.clientId;
            
            if (!clientId) {
                toast.error("No WhatsApp client connected");
                return;
            }
            
            // Make a POST request to the test message endpoint
            const response = await fetch(`/api/whatsapp/test-message?clientId=${clientId}`, {
                method: 'POST',
            });
            
            if (response.ok) {
                toast.success("Test message sent");
            } else {
                const error = await response.text();
                toast.error(`Failed to send test message: ${error}`);
            }
        } catch (error) {
            console.error("Error sending test message:", error);
            toast.error("Failed to send test message");
        }
    }
    
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title={title} />

    <PageContent>
        <div class="space-y-6">
            <!-- WhatsApp Connection Status -->
            <div class="flex items-center space-x-2">
                <span class="font-medium">Status:</span>
                {#if $whatsAppStore?.connectionStatus}
                    <span class="px-2 py-1 text-xs font-medium rounded-full
                        {$whatsAppStore.connectionStatus === 'connected' || $whatsAppStore.connectionStatus === 'authenticated' ? 'bg-green-100 text-green-800' : 
                        $whatsAppStore.connectionStatus === 'connecting' || $whatsAppStore.connectionStatus === 'awaiting_scan' ? 'bg-yellow-100 text-yellow-800' : 
                        'bg-red-100 text-red-800'}"
                    >
                        {$whatsAppStore.connectionStatus}
                    </span>
                {:else}
                    <Skeleton class="h-6 w-20" />
                {/if}
            </div>

            <!-- Error Message (if any) -->
            {#if $whatsAppStore?.error}
                <div class="p-4 border rounded-lg bg-red-50 text-red-800">
                    <div class="flex items-center">
                        <AlertTriangle class="h-5 w-5 mr-2" />
                        <span>{$whatsAppStore.error}</span>
                    </div>
                </div>
            {/if}

            <!-- Messages Section -->
            <div class="space-y-4">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold">Messages</h3>
                    <div class="flex items-center gap-2">
                        <div class="text-sm text-gray-500">
                            {$whatsAppStore?.messages?.length || 0} message(s)
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            class="h-8 w-8 p-0" 
                            title="Refresh" 
                            on:click={refreshMessages} 
                            disabled={isRefreshing}
                        >
                            <RefreshCw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
                        </Button>
                    </div>
                </div>

                {#if isRefreshing}
                    <div class="space-y-3 p-4 border rounded-lg">
                        <Skeleton class="h-24 w-full rounded-lg" />
                        <Skeleton class="h-24 w-full rounded-lg" />
                        <Skeleton class="h-24 w-full rounded-lg" />
                    </div>
                {:else if $whatsAppStore?.messages?.length}
                    <div class="space-y-3 max-h-[500px] overflow-y-auto p-2 border rounded-lg">
                        {#each $whatsAppStore.messages as message (message.id)}
                            <div class="p-4 rounded-lg border shadow-sm {message.isFromMe ? 'ml-12 bg-blue-50 border-blue-200' : 'mr-12 bg-gray-50 border-gray-200'}">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center">
                                        <span class="font-medium truncate max-w-[150px]">{message.from}</span>
                                        <span class="text-xs text-gray-500 ml-2">• {new Date(message.timestamp).toLocaleString()}</span>
                                    </div>
                                    <span class="text-xs px-2 py-1 bg-gray-100 rounded-full">{message.type}</span>
                                </div>
                                <div class="break-words whitespace-pre-wrap">{message.content}</div>
                                {#if message.mediaUrl}
                                    <div class="mt-2 flex items-center">
                                        <a href={message.mediaUrl} target="_blank" class="flex items-center text-blue-600 hover:text-blue-800 hover:underline">
                                            <span class="mr-1">Media:</span> {message.fileName || 'View'}
                                        </a>
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {:else if !isRefreshing}
                    <div class="p-6 border rounded-lg bg-gray-50 text-gray-500 text-center">
                        <div class="flex flex-col items-center justify-center space-y-2">
                            <span>No messages received yet</span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                class="mt-2" 
                                on:click={refreshMessages}
                                disabled={isRefreshing}
                            >
                                <RefreshCw class="h-4 w-4 mr-2 {isRefreshing ? 'animate-spin' : ''}" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </PageContent>
</PageContainer>
