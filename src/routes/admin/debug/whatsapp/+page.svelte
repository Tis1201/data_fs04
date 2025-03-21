<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import * as Select from "$lib/components/ui/select";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
    import { Send, MessageSquare, RefreshCw, AlertCircle } from "lucide-svelte";
    import { onMount, onDestroy } from "svelte";
    import { writable } from "svelte/store";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";
    import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '$lib/components/ui/breadcrumb';
    import { superForm } from 'sveltekit-superforms/client';
    import { toast } from 'svelte-sonner';

    export let data: PageData;
    
    const { form, errors, enhance, message, constraints } = superForm(data.form, {
        onResult: ({ result }) => {
            if (result.type === 'success') {
                toast.success('Message sent successfully');
                // Clear the message field but keep the account and recipient
                $form.message = '';
            } else if (result.type === 'failure') {
                toast.error(result.data.error || 'Failed to send message');
            }
        }
    });

    // Store for received messages
    const messages = writable<{
        id: string;
        clientId: string;
        accountId: string;
        sender: string;
        content: string;
        timestamp: string;
        fromMe: boolean;
    }[]>([]);

    // Selected account for viewing messages and sending messages
    let selectedAccountId = data.accounts.length > 0 ? data.accounts[0].id : '';
    $: selectedAccount = data.accounts.find(a => a.id === selectedAccountId);
    
    // Create a formatted object for the select component
    $: selectedAccountOption = selectedAccountId ? {
        value: selectedAccountId,
        label: selectedAccount ? 
            `${selectedAccount.phoneNumber} (${selectedAccount.name || selectedAccount.description || 'No description'})` : 
            'Select an account'
    } : undefined;
    
    // Account status management
    let accountStatus = 'unknown';
    let isLoadingStatus = false;
    
    // Set form account ID when selectedAccountId changes
    $: if (selectedAccountId) {
        $form.accountId = selectedAccountId;
    }
    
    // Browser-only status check
    let isBrowser = typeof window !== 'undefined';
    
    // Function to fetch account status from server
    async function fetchAccountStatus(accountId: string) {
        if (!accountId || !isBrowser) return;
        
        try {
            isLoadingStatus = true;
            const response = await fetch(`/admin/debug/whatsapp/status/${accountId}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success' && data.account) {
                    accountStatus = data.account.client_status || 'disconnected';
                } else {
                    accountStatus = 'error';
                }
            } else {
                accountStatus = 'error';
            }
        } catch (error) {
            console.error('Error fetching account status:', error);
            accountStatus = 'error';
        } finally {
            isLoadingStatus = false;
        }
    }

    // Status display helpers
    function getStatusColor(status: string): string {
        switch (status) {
            case 'connected':
                return 'bg-green-500';
            case 'connecting':
                return 'bg-yellow-500';
            case 'error':
                return 'bg-red-500';
            case 'disconnected':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    }
    
    function getStatusText(status: string): string {
        switch (status) {
            case 'connected':
                return 'Online';
            case 'connecting':
                return 'Connecting';
            case 'error':
                return 'Error';
            case 'disconnected':
                return 'Offline';
            default:
                return 'Unknown';
        }
    }

    // Function to refresh the status of the selected account
    function refreshStatus() {
        if (selectedAccountId) {
            fetchAccountStatus(selectedAccountId);
            toast.info('Refreshing account status...');
        }
    }
    
    // WebSocket connection
    let ws: WebSocket;
    const connectionStatus = writable<string>('disconnected');
    const clientStatuses = writable<Record<string, string>>({});
    let pendingStatusChecks: string[] = [];
    
    function connectWebSocket() {
        if (ws) {
            try {
                ws.close();
            } catch (e) {
                console.error('Error closing existing WebSocket:', e);
            }
        }
        
        $connectionStatus = 'connecting';
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/admin/debug/whatsapp/ws`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            $connectionStatus = 'connected';
            toast.success('WebSocket connected');
            
            // Process any pending status checks
            if (pendingStatusChecks.length > 0) {
                console.log('Processing pending status checks:', pendingStatusChecks);
                pendingStatusChecks.forEach(accountId => {
                    fetchAccountStatus(accountId);
                });
                pendingStatusChecks = [];
            }
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            $connectionStatus = 'disconnected';
            toast.error('WebSocket disconnected');
            
            // Try to reconnect after a delay
            setTimeout(connectWebSocket, 5000);
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            $connectionStatus = 'error';
            toast.error('WebSocket error');
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle WhatsApp messages
                if (data.type === 'whatsapp' && data.action === 'message') {
                    console.log('Received WhatsApp message:', data);
                    
                    // Add the message to our store
                    $messages = [{
                        id: data.data.messageId,
                        clientId: data.data.clientId,
                        accountId: data.data.accountId,
                        sender: data.data.sender,
                        content: data.data.content,
                        timestamp: data.data.timestamp,
                        fromMe: data.data.rawMessage?.key?.fromMe || false
                    }, ...$messages];
                }
                
                // Handle connection status updates
                if (data.type === 'whatsapp' && data.action === 'connectionStatus') {
                    console.log('WhatsApp connection status update:', data);
                    // Store status for each client ID
                    $clientStatuses = { ...$clientStatuses, [data.data.clientId]: data.data.status };
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
    }

    onMount(() => {
        // Set initial form values and selectedAccountId if we have accounts
        if (data.accounts.length > 0) {
            selectedAccountId = data.accounts[0].id;
            $form.accountId = selectedAccountId;
            
            // Initial status check for the selected account
            if (selectedAccountId) {
                fetchAccountStatus(selectedAccountId);
            }
            
            // Connect to WebSocket
            connectWebSocket();
            
            // Set up periodic status checks
            const statusInterval = setInterval(() => {
                if (selectedAccountId) {
                    fetchAccountStatus(selectedAccountId);
                }
            }, 30000); // Check every 30 seconds
            
            return () => {
                clearInterval(statusInterval);
                if (ws) {
                    try {
                        ws.close();
                    } catch (e) {
                        console.error('Error closing WebSocket:', e);
                    }
                }
            };
        }
    });

    // Filter messages for the selected account
    $: filteredMessages = $messages.filter(msg => msg.accountId === selectedAccountId);
    
    // Request status check when account changes (browser-only)
    $: if (isBrowser && selectedAccount && selectedAccount.id) {
        fetchAccountStatus(selectedAccount.id);
    }
</script>

<div class="space-y-4 p-4">
    <Breadcrumb>
        <BreadcrumbList>
            <BreadcrumbItem>
                <a href="/admin" class="text-sm font-medium underline-offset-4 hover:underline">Main</a>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>Debug</BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
                <BreadcrumbPage>WhatsApp</BreadcrumbPage>
            </BreadcrumbItem>
        </BreadcrumbList>
    </Breadcrumb>

    <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-semibold">
            WhatsApp Debug Console
        </h1>
        
        <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" on:click={() => {
                if (ws) {
                    ws.close();
                }
                connectWebSocket();
            }}>
                <RefreshCw class="h-4 w-4 mr-2" />
                Reconnect
            </Button>
        </div>
    </div>
    
    <!-- Top-level account selection -->
    <div class="flex items-center justify-between bg-muted p-3 rounded-lg mb-4">
        <div class="flex items-center gap-4">
            <div>
                <div class="w-[250px]">
                    <Select.Root
                        selected={selectedAccountOption}
                        onSelectedChange={(option) => {
                            if (option) {
                                selectedAccountId = option.value;
                            }
                        }}
                    >
                        <Select.Trigger>
                            <Select.Value placeholder="Select an account" />
                        </Select.Trigger>
                        <Select.Content>
                            {#each data.accounts as account}
                                <Select.Item 
                                    value={account.id} 
                                    label={`${account.phoneNumber} (${account.name || account.description || 'No description'})`}
                                />
                            {/each}
                        </Select.Content>
                    </Select.Root>
                </div>
            </div>
            
            {#if selectedAccount}
                <div class="flex items-center gap-2">
                    {#if isLoadingStatus}
                        <div class="h-3 w-3 rounded-full bg-gray-300 animate-pulse"></div>
                        <span class="text-sm font-medium">Loading...</span>
                    {:else}
                        <div class="h-3 w-3 rounded-full {getStatusColor(accountStatus)}"></div>
                        <span class="text-sm font-medium">{getStatusText(accountStatus)}</span>
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Send Message Panel -->
        <Card>
            <CardHeader>
                <CardTitle>Send Message</CardTitle>
                <CardDescription>Send a WhatsApp message from a selected account</CardDescription>
            </CardHeader>
            <CardContent>
                <form method="POST" action="?/sendMessage" use:enhance class="space-y-4">
                    <input type="hidden" name="accountId" value={selectedAccountId}>

                    <div class="space-y-2">
                        <Label for="recipient">Recipient</Label>
                        <Input 
                            id="recipient" 
                            name="recipient" 
                            bind:value={$form.recipient} 
                            placeholder="Phone number (e.g., +65XXXXXXXX) or JID" 
                            required
                        />
                        {#if $errors.recipient}
                            <p class="text-sm text-red-500">{$errors.recipient}</p>
                        {/if}
                    </div>

                    <div class="space-y-2">
                        <Label for="message">Message</Label>
                        <Textarea 
                            id="message" 
                            name="message" 
                            bind:value={$form.message} 
                            placeholder="Type your message here" 
                            rows="4" 
                            required
                        />
                        {#if $errors.message}
                            <p class="text-sm text-red-500">{$errors.message}</p>
                        {/if}
                    </div>
                    
                    <Button type="submit" class="w-full">
                        <Send class="h-4 w-4 mr-2" />
                        Send Message
                    </Button>
                </form>
            </CardContent>
        </Card>

        <!-- Message History Panel -->
        <Card>
            <CardHeader>
                <CardTitle>Message History</CardTitle>
                <CardDescription>Messages for {selectedAccount?.phoneNumber || 'selected account'}</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="h-[400px] overflow-y-auto space-y-4 p-2">
                    {#if !selectedAccount}
                        <div class="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                            <AlertCircle class="h-12 w-12 mb-2 opacity-50" />
                            <p>No account selected</p>
                            <p class="text-sm">Please select an account from the dropdown above</p>
                        </div>
                    {:else if filteredMessages.length === 0}
                        <div class="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                            <MessageSquare class="h-12 w-12 mb-2 opacity-50" />
                            <p>No messages yet</p>
                            <p class="text-sm">Messages will appear here when received</p>
                        </div>
                    {:else}
                        {#each filteredMessages as message}
                            <div class="flex {message.fromMe ? 'justify-end' : 'justify-start'}">
                                <div class="max-w-[80%] rounded-lg p-3 {message.fromMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}">
                                    <div class="text-sm font-medium">
                                        {message.fromMe ? 'You' : message.sender}
                                    </div>
                                    <div class="mt-1">{message.content}</div>
                                    <div class="text-xs opacity-70 text-right mt-1">
                                        {new Date(message.timestamp).toLocaleTimeString()}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            </CardContent>
        </Card>
    </div>

    {#if data.accounts.length === 0}
        <Alert variant="destructive">
            <AlertCircle class="h-4 w-4" />
            <AlertTitle>No WhatsApp accounts found</AlertTitle>
            <AlertDescription>
                You need to create a WhatsApp account before you can use this debug console.
                <a href="/admin/whatsapp/accounts/new" class="underline">Create a new account</a>
            </AlertDescription>
        </Alert>
    {/if}
</div>
