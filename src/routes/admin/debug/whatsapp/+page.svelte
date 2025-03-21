<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
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
    
    // Update form when selectedAccountId changes
    $: if (selectedAccountId) {
        $form.accountId = selectedAccountId;
    }

    // WebSocket connection
    let ws: WebSocket | null = null;
    let wsConnected = writable(false);
    let connectionStatus = writable('disconnected');

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws`;
        
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            $wsConnected = true;
            $connectionStatus = 'connected';
            toast.success('WebSocket connected');
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            $wsConnected = false;
            $connectionStatus = 'disconnected';
            toast.error('WebSocket disconnected');
            
            // Attempt to reconnect after a delay
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
                    if (data.data.clientId === selectedAccount?.client_id) {
                        $connectionStatus = data.data.status;
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
    }

    onMount(() => {
        // Set initial form values if we have accounts
        if (data.accounts.length > 0) {
            $form.accountId = data.accounts[0].id;
        }
        
        // Connect to WebSocket
        connectWebSocket();
    });

    onDestroy(() => {
        // Close WebSocket connection when component is destroyed
        if (ws && $wsConnected) {
            ws.close();
        }
    });

    // Filter messages for the selected account
    $: filteredMessages = $messages.filter(msg => msg.accountId === selectedAccountId);
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
                <Select bind:value={selectedAccountId}>
                    <SelectTrigger class="w-[250px]">
                        <SelectValue placeholder="Select an account" />
                    </SelectTrigger>
                    <SelectContent>
                        {#each data.accounts as account}
                            <SelectItem value={account.id}>{account.phoneNumber} ({account.name})</SelectItem>
                        {/each}
                    </SelectContent>
                </Select>
            </div>
            
            {#if selectedAccount}
                <div class="flex items-center gap-2">
                    <div class="h-3 w-3 rounded-full {$connectionStatus === 'connected' ? 'bg-green-500' : $connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}"></div>
                    <span class="text-sm font-medium">{$connectionStatus === 'connected' ? 'Online' : $connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}</span>
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
