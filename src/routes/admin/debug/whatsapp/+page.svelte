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
    import EnhancedSelect from "$lib/components/ui_components_sveltekit/form/EnhancedSelect.svelte";
    import { whatsAppStore } from "$lib/stores/whatsapp-store";
    import type { ConnectionStatus, WhatsAppMessage } from "$lib/stores/whatsapp-store";
    import type { PageData } from './$types';
    import { writable, derived } from 'svelte/store';
    import { onDestroy, onMount } from 'svelte';
    import { enhance } from "$app/forms";
    
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
    
    // Get accounts from server data
    const accounts = data.accounts || [];
    
    // Format accounts for the select component
    const accountOptions = accounts.map(account => ({
        value: account.id,
        label: `${account.name || account.description || 'Unnamed'} (${account.phoneNumber || 'No phone'})`
    }));
    
    // Selected account ID
    let selectedAccountId = accountOptions.length > 0 ? accountOptions[0].value : '';
    
    // Get the client ID for the selected account
    $: selectedAccount = accounts.find(account => account.id === selectedAccountId);
    $: selectedClientId = selectedAccount?.client_id || null;
    
    // Store for real-time client status
    const clientStatus = writable<{ state: string; pushName: string | null; phoneNumber: string | null } | null>(null);
    
    // Filter messages based on selected account
    $: filteredMessages = $whatsAppStore?.messages?.filter(message => {
        // If no account is selected, show all messages
        if (!selectedAccountId) return true;
        
        // If the message has an accountId, filter by that
        if (message.accountId) return message.accountId === selectedAccountId;
        
        // If the message has a clientId, match it with the selected account's client_id
        if (message.clientId && selectedAccount) return message.clientId === selectedAccount.client_id;
        
        // Default to showing the message
        return true;
    }) || [];
    
    // Function to fetch real-time client status
    async function fetchClientStatus(clientId: string) {
        if (!clientId) return;
        
        const formData = new FormData();
        formData.append('clientId', clientId);
        
        try {
            const response = await fetch('?/getClientStatus', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success && result.clientInfo) {
                clientStatus.set({
                    state: result.clientInfo.state,
                    pushName: result.clientInfo.pushName,
                    phoneNumber: result.clientInfo.phoneNumber
                });
            } else {
                clientStatus.set(null);
            }
        } catch (error) {
            console.error('Error fetching client status:', error);
            clientStatus.set(null);
        }
    }
    
    // Handle account selection change
    function handleAccountChange(event: CustomEvent<string>) {
        selectedAccountId = event.detail;
        console.log('Selected account:', selectedAccountId);
        
        // If the account has a client ID, update the store
        const account = accounts.find(acc => acc.id === selectedAccountId);
        if (account?.client_id) {
            whatsAppStore.setClientId(account.client_id);
            
            // Fetch the real-time status
            fetchClientStatus(account.client_id);
        } else {
            // Reset client status if no client ID
            clientStatus.set(null);
        }
    }
    
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
    
    // Set up interval to refresh client status
    let statusInterval: ReturnType<typeof setInterval>;
    
    onMount(() => {
        // Initial fetch if an account is selected
        if (selectedClientId) {
            fetchClientStatus(selectedClientId);
        }
        
        // Set up interval to refresh status every 5 seconds
        statusInterval = setInterval(() => {
            if (selectedClientId) {
                fetchClientStatus(selectedClientId);
            }
        }, 5000);
    });
    
    // Clean up subscriptions when component is destroyed
    onDestroy(() => {
        unsubscribe();
        if (statusInterval) clearInterval(statusInterval);
    });
    
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
            // Get the client ID from the selected account
            const clientId = selectedClientId;
            
            if (!clientId) {
                toast.error("No WhatsApp client connected for the selected account");
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
    
    // Initialize the store with the selected account's client ID on mount
    onMount(() => {
        if (selectedAccount?.client_id) {
            whatsAppStore.setClientId(selectedAccount.client_id);
        }
    });
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title={title} />

    <PageContent>
        <div class="space-y-6">
            <!-- Account Selector -->
            <div class="grid gap-4 md:grid-cols-2">
                <div>
                    <label for="account-select" class="block text-sm font-medium mb-2">WhatsApp Account</label>
                    <EnhancedSelect
                        name="account-select"
                        options={accountOptions}
                        value={selectedAccountId}
                        placeholder="Select an account"
                        on:change={handleAccountChange}
                        disabled={accountOptions.length === 0}
                    />
                </div>
                
                <!-- WhatsApp Connection Status -->
                <div>
                    <div class="block text-sm font-medium mb-2">Connection Status</div>
                    <div class="flex items-center space-x-2 h-10">
                        {#if $clientStatus !== null}
                            <!-- Use real-time status from WhatsAppAccountManager -->
                            <span class="px-2 py-1 text-xs font-medium rounded-full
                                {$clientStatus.state === 'connected' || $clientStatus.state === 'authenticated' ? 'bg-green-100 text-green-800' : 
                                $clientStatus.state === 'connecting' || $clientStatus.state === 'awaiting_scan' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'}"
                            >
                                {$clientStatus.state}
                            </span>
                            {#if $clientStatus.pushName}
                                <span class="text-sm text-gray-600">({$clientStatus.pushName})</span>
                            {/if}
                        {:else if $whatsAppStore?.connectionStatus}
                            <!-- Fallback to store status if real-time status is not available -->
                            <span class="px-2 py-1 text-xs font-medium rounded-full
                                {$whatsAppStore.connectionStatus === 'connected' || $whatsAppStore.connectionStatus === 'authenticated' ? 'bg-green-100 text-green-800' : 
                                $whatsAppStore.connectionStatus === 'connecting' || $whatsAppStore.connectionStatus === 'awaiting_scan' ? 'bg-yellow-100 text-yellow-800' : 
                                'bg-red-100 text-red-800'}"
                            >
                                {$whatsAppStore.connectionStatus}
                            </span>
                            {#if $whatsAppStore.pushName}
                                <span class="text-sm text-gray-600">({$whatsAppStore.pushName})</span>
                            {/if}
                        {:else}
                            <Skeleton class="h-6 w-20" />
                        {/if}
                    </div>
                </div>
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
                            {filteredMessages.length} message(s)
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
                {:else if filteredMessages.length}
                    <div class="space-y-3 max-h-[500px] overflow-y-auto p-2 border rounded-lg">
                        {#each filteredMessages as message (message.id)}
                            <div class="p-4 rounded-lg border shadow-sm {message.isFromMe ? 'ml-12 bg-blue-50 border-blue-200' : 'mr-12 bg-gray-50 border-gray-200'}">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center">
                                        <span class="font-medium truncate max-w-[150px]">{message.fromName || message.from}</span>
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
                            <span>
                                {accountOptions.length === 0 ? 'No WhatsApp accounts available' : 
                                 $whatsAppStore?.messages?.length ? 'No messages for the selected account' : 'No messages received yet'}
                            </span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                class="mt-2" 
                                on:click={refreshMessages}
                                disabled={isRefreshing || accountOptions.length === 0}
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
