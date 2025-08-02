<script lang="ts">
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    import AdminCard from "$lib/components/admin/layout/AdminCard.svelte";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Database, RefreshCw, Plus, Search, Trash, Wifi, WifiOff, Send, MessageSquare, Video } from "lucide-svelte";
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { Badge } from "$lib/components/ui/badge";
    import { Separator } from "$lib/components/ui/separator";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { toast } from "svelte-sonner";
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "$lib/components/ui/dialog";
    import { Textarea } from "$lib/components/ui/textarea";

    const title = `Redis Debug`;
    const pageCrumbs = [
        ["Admin", "/admin/dashboard"],
        ["Debug"],
        ["Redis"],
    ] as [string, string][];

    const actionButtons = [
        {
            label: "Back",
            onClick: () => {
                goto("/admin/dashboard");
            },
        },
    ];
    
    // State for Redis operations
    let keyInput = "";
    let valueInput = "";
    let ttlInput = "3600";
    let searchKey = "";
    let searchResult: { key: string; value: string | null; exists: boolean } | null = null;
    let isLoading = false;
    let errorMessage = "";
    let successMessage = "";
    let recentKeys: string[] = [];
    
    // State for connected devices
    let connectedDevices: Array<{
        id: string;
        status: string;
        first_connected?: string;
        last_disconnected?: string;
        connection_count?: number;
        history?: string[];
    }> = [];
    let isLoadingDevices = false;
    let deviceError = "";
    
    // State for publish dialog
    let showPublishDialog = false;
    let selectedDeviceId = "";
    let messageContent = "";
    let isPublishing = false;
    let publishError = "";
    
    // State for WebRTC offer dialog
    let showWebRTCDialog = false;
    let webrtcDeviceId = "";
    let webrtcConnectionId = "";
    let isWebRTCPublishing = false;
    let webrtcError = "";
    
    // Function to get a value from Redis
    async function getValue() {
        if (!searchKey) {
            errorMessage = "Please enter a key to search";
            return;
        }
        
        isLoading = true;
        errorMessage = "";
        successMessage = "";
        
        try {
            const response = await fetch(`/admin/debug/redis?key=${encodeURIComponent(searchKey)}`);
            const data = await response.json();
            
            if (response.ok) {
                searchResult = data;
                if (!recentKeys.includes(searchKey) && data.exists) {
                    recentKeys = [searchKey, ...recentKeys.slice(0, 4)];
                }
                successMessage = data.exists ? "Key found in Redis" : "Key not found in Redis";
            } else {
                errorMessage = data.error || "Failed to get value from Redis";
                searchResult = null;
            }
        } catch (error) {
            errorMessage = `Error: ${error.message}`;
            searchResult = null;
        } finally {
            isLoading = false;
        }
    }
    
    // Function to set a value in Redis
    async function setValue() {
        if (!keyInput) {
            errorMessage = "Please enter a key";
            return;
        }
        
        if (valueInput === undefined) {
            errorMessage = "Please enter a value";
            return;
        }
        
        isLoading = true;
        errorMessage = "";
        successMessage = "";
        
        try {
            const ttl = ttlInput ? parseInt(ttlInput) : undefined;
            
            const response = await fetch('/admin/debug/redis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: keyInput,
                    value: valueInput,
                    ttl: ttl
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                successMessage = `Successfully set key '${keyInput}' in Redis`;
                if (!recentKeys.includes(keyInput)) {
                    recentKeys = [keyInput, ...recentKeys.slice(0, 4)];
                }
                toast.success("Value set successfully", {
                    description: `Key: ${keyInput}, TTL: ${ttl || 'none'}`
                });
                // Clear inputs
                valueInput = "";
            } else {
                errorMessage = data.error || "Failed to set value in Redis";
                toast.error("Failed to set value", {
                    description: errorMessage
                });
            }
        } catch (error) {
            errorMessage = `Error: ${error.message}`;
            toast.error("Error", {
                description: errorMessage
            });
        } finally {
            isLoading = false;
        }
    }
    
    // Function to delete a key from Redis
    async function deleteKey(key: string) {
        isLoading = true;
        errorMessage = "";
        successMessage = "";
        
        try {
            const response = await fetch('/admin/debug/redis', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ key })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                successMessage = `Successfully deleted key '${key}' from Redis`;
                recentKeys = recentKeys.filter(k => k !== key);
                if (searchResult?.key === key) {
                    searchResult = null;
                }
                toast.success("Key deleted successfully", {
                    description: `Key: ${key}`
                });
            } else {
                errorMessage = data.error || "Failed to delete key from Redis";
                toast.error("Failed to delete key", {
                    description: errorMessage
                });
            }
        } catch (error) {
            errorMessage = `Error: ${error.message}`;
            toast.error("Error", {
                description: errorMessage
            });
        } finally {
            isLoading = false;
        }
    }
    
    // Function to select a recent key
    function selectRecentKey(key: string) {
        searchKey = key;
        getValue();
    }
    
    // Function to list all connected devices
    async function listConnectedDevices() {
        isLoadingDevices = true;
        deviceError = "";
        
        try {
            // First, get all device keys using a pattern match
            const response = await fetch('/admin/debug/redis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: 'device:*:status',
                    value: '_KEYS_PATTERN_',
                    command: 'keys'
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                deviceError = data.error || "Failed to get device keys";
                return;
            }
            
            const deviceKeys = data.keys || [];
            const devices = [];
            
            // For each device key, get the status and metadata
            for (const key of deviceKeys) {
                const deviceId = key.split(':')[1]; // Extract device ID from key pattern
                
                // Get device status
                const statusResponse = await fetch(`/admin/debug/redis?key=${encodeURIComponent(key)}`);
                const statusData = await statusResponse.json();
                
                // Get device metadata
                const metaResponse = await fetch(`/admin/debug/redis?key=${encodeURIComponent(`device:${deviceId}:meta`)}`);
                const metaData = await metaResponse.json();
                
                // Get device history
                const historyResponse = await fetch('/admin/debug/redis', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        key: `device:${deviceId}:history`,
                        value: '0 9', // Get last 10 entries
                        command: 'lrange'
                    })
                });
                
                const historyData = await historyResponse.json();
                
                let deviceInfo = {
                    id: deviceId,
                    status: statusData.exists ? statusData.value : 'unknown'
                };
                
                // Add metadata if available
                if (metaData.exists && metaData.value) {
                    try {
                        const meta = JSON.parse(metaData.value);
                        deviceInfo = { ...deviceInfo, ...meta };
                    } catch (e) {
                        console.error(`Error parsing metadata for device ${deviceId}:`, e);
                    }
                }
                
                // Add history if available
                if (historyData.result && Array.isArray(historyData.result)) {
                    deviceInfo.history = historyData.result;
                }
                
                devices.push(deviceInfo);
            }
            
            connectedDevices = devices;
        } catch (error) {
            deviceError = `Error: ${error.message}`;
        } finally {
            isLoadingDevices = false;
        }
    }
    
    // Load connected devices on mount
    onMount(() => {
        if (browser) {
            listConnectedDevices();
        }
    });
    
    // Function to open publish dialog
    function openPublishDialog(deviceId: string) {
        selectedDeviceId = deviceId;
        messageContent = JSON.stringify({
            action: 'message',
            type: 'notification',
            message: 'Hello from admin'
        }, null, 2);
        publishError = "";
        showPublishDialog = true;
    }
    
    // Function to open WebRTC offer dialog
    function openWebRTCDialog(deviceId: string) {
        webrtcDeviceId = deviceId;
        webrtcConnectionId = crypto.randomUUID();
        webrtcError = "";
        showWebRTCDialog = true;
    }
    
    // Function to publish message to device
    async function publishMessageToDevice() {
        if (!selectedDeviceId || !messageContent) {
            publishError = "Device ID and message content are required";
            return;
        }
        
        isPublishing = true;
        publishError = "";
        
        try {
            let messagePayload;
            try {
                // Parse the user-entered JSON content
                messagePayload = JSON.parse(messageContent);
            } catch (e) {
                publishError = "Invalid JSON format. Please check your message content.";
                isPublishing = false;
                return;
            }
            
            // Format the message with the proper device message structure
            const deviceMessage = {
                type: 'device',
                payload: messagePayload,
                scope: `device:${selectedDeviceId}`
            };
            
            // Send the request to the server
            const response = await fetch('/admin/debug/redis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: selectedDeviceId,
                    value: JSON.stringify(deviceMessage),
                    command: 'publish'
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                toast.success("Message published successfully", {
                    description: `Published to device: ${selectedDeviceId}`
                });
                showPublishDialog = false;
                messageContent = "";
            } else {
                publishError = data.error || "Failed to publish message";
                toast.error("Failed to publish message", {
                    description: publishError
                });
            }
        } catch (error) {
            publishError = `Error: ${error.message}`;
            toast.error("Error", {
                description: publishError
            });
        } finally {
            isPublishing = false;
        }
    }
    
    // Function to send WebRTC offer to device
    async function sendWebRTCOffer() {
        if (!webrtcDeviceId || !webrtcConnectionId) {
            webrtcError = "Device ID and connection ID are required";
            return;
        }
        
        isWebRTCPublishing = true;
        webrtcError = "";
        
        try {
            // Create the WebRTC offer message in the correct format
            const offerPayload = {
                action: 'message',
                type: 'webrtc:connect',
                deviceId: webrtcDeviceId
            };
            
            // Format the message according to the device messaging system format
            const messageObject = {
                channel: webrtcDeviceId,
                content: JSON.stringify({
                    type: 'device',
                    payload: offerPayload,
                    scope: `connection:${webrtcConnectionId}`
                })
            };
            
            const response = await fetch('/admin/debug/redis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: 'messages',
                    value: JSON.stringify(messageObject),
                    command: 'publish'
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                toast.success("WebRTC connect request sent", {
                    description: `Connection ID: ${webrtcConnectionId}`
                });
                showWebRTCDialog = false;
            } else {
                webrtcError = data.error || "Failed to send WebRTC connect request";
                toast.error("Failed to send WebRTC connect request", {
                    description: webrtcError
                });
            }
        } catch (error) {
            webrtcError = `Error: ${error.message}`;
            toast.error("Error", {
                description: webrtcError
            });
        } finally {
            isWebRTCPublishing = false;
        }
    }
</script>

<AdminPageLayout
    {title}
    crumbs={pageCrumbs}
    {actionButtons}
    showCreateButton={false}
    compact={true}
    contentSpacing="space-y-4"
>
    <AdminCard
      title="Redis Operations"
      description="Interact with Redis for debugging purposes"
      icon={Database}
      compact={true}
    >
        <div class="space-y-6">
            <!-- Set Value Section -->
            <div class="space-y-4">
                <h3 class="text-lg font-medium">Set Value</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label for="key-input">Key</Label>
                        <Input id="key-input" bind:value={keyInput} placeholder="Enter key" />
                    </div>
                    <div>
                        <Label for="value-input">Value</Label>
                        <Input id="value-input" bind:value={valueInput} placeholder="Enter value" />
                    </div>
                    <div>
                        <Label for="ttl-input">TTL (seconds, optional)</Label>
                        <Input id="ttl-input" bind:value={ttlInput} placeholder="e.g. 3600" type="number" />
                    </div>
                </div>
                <Button on:click={setValue} disabled={isLoading}>
                    {#if isLoading}
                        <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                    {:else}
                        <Plus class="mr-2 h-4 w-4" />
                    {/if}
                    Set Value
                </Button>
            </div>
            
            <Separator />
            
            <!-- Get Value Section -->
            <div class="space-y-4">
                <h3 class="text-lg font-medium">Get Value</h3>
                <div class="flex space-x-4">
                    <div class="flex-1">
                        <Label for="search-key">Key</Label>
                        <Input id="search-key" bind:value={searchKey} placeholder="Enter key to search" />
                    </div>
                    <div class="flex items-end">
                        <Button on:click={getValue} disabled={isLoading} variant="outline">
                            {#if isLoading}
                                <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                            {:else}
                                <Search class="mr-2 h-4 w-4" />
                            {/if}
                            Get Value
                        </Button>
                    </div>
                </div>
                
                <!-- Recent Keys -->
                {#if recentKeys.length > 0}
                    <div class="flex flex-wrap gap-2">
                        <span class="text-sm text-muted-foreground">Recent keys:</span>
                        {#each recentKeys as key}
                            <Badge 
                                variant="outline" 
                                class="cursor-pointer hover:bg-muted" 
                                on:click={() => selectRecentKey(key)}
                            >
                                {key}
                            </Badge>
                        {/each}
                    </div>
                {/if}
                
                <!-- Search Result -->
                {#if isLoading}
                    <div class="space-y-2">
                        <Skeleton class="h-8 w-full" />
                        <Skeleton class="h-24 w-full" />
                    </div>
                {:else if searchResult}
                    <div class="p-4 border rounded-md space-y-2">
                        <div class="flex justify-between items-center">
                            <h4 class="font-medium">{searchResult.key}</h4>
                            <Button 
                                variant="destructive" 
                                size="sm" 
                                on:click={() => deleteKey(searchResult.key)}
                            >
                                <Trash class="h-4 w-4" />
                            </Button>
                        </div>
                        <div class="bg-muted p-2 rounded-md overflow-x-auto">
                            {#if searchResult.exists}
                                <pre class="text-sm">{searchResult.value}</pre>
                            {:else}
                                <p class="text-sm text-muted-foreground">Key does not exist</p>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
            
            <!-- Messages -->
            {#if errorMessage}
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            {/if}
            
            {#if successMessage}
                <Alert variant="default">
                    <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
            {/if}
        </div>
    </AdminCard>
    
    <!-- Connected Devices Card -->
    <AdminCard
      title="Connected Devices"
      description="List of all devices connected through Pushpin"
      icon={Wifi}
      class="mt-6"
    >
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium">Device Status</h3>
                <Button variant="outline" size="sm" on:click={listConnectedDevices}>
                    <RefreshCw class="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>
            
            {#if deviceError}
                <Alert variant="destructive">
                    <AlertDescription>{deviceError}</AlertDescription>
                </Alert>
            {/if}
            
            {#if isLoadingDevices}
                <div class="space-y-2">
                    <Skeleton class="h-12 w-full" />
                    <Skeleton class="h-12 w-full" />
                    <Skeleton class="h-12 w-full" />
                </div>
            {:else if connectedDevices.length === 0}
                <Alert>
                    <AlertDescription>No connected devices found</AlertDescription>
                </Alert>
            {:else}
                <div class="space-y-4">
                    {#each connectedDevices as device}
                        <div class="border rounded-md p-4">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center">
                                    {#if device.status === 'online'}
                                        <Wifi class="h-5 w-5 text-green-500 mr-2" />
                                    {:else}
                                        <WifiOff class="h-5 w-5 text-red-500 mr-2" />
                                    {/if}
                                    <h4 class="font-medium">{device.id}</h4>
                                </div>
                                <div class="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        on:click={() => openPublishDialog(device.id)}
                                        disabled={device.status !== 'online'}
                                        title={device.status === 'online' ? 'Send message to device' : 'Device is offline'}
                                    >
                                        <MessageSquare class="h-4 w-4 mr-1" />
                                        Publish
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        on:click={() => openWebRTCDialog(device.id)}
                                        disabled={device.status !== 'online'}
                                        title={device.status === 'online' ? 'Send WebRTC connect request' : 'Device is offline'}
                                    >
                                        <Video class="h-4 w-4 mr-1" />
                                        WebRTC
                                    </Button>
                                    <Badge variant={device.status === 'online' ? 'default' : 'outline'}>
                                        {device.status}
                                    </Badge>
                                </div>
                            </div>
                            
                            <div class="mt-2 text-sm text-muted-foreground grid grid-cols-2 gap-2">
                                {#if device.first_connected}
                                    <div>
                                        <span class="font-medium">First connected:</span> 
                                        {new Date(device.first_connected).toLocaleString()}
                                    </div>
                                {/if}
                                
                                {#if device.last_disconnected}
                                    <div>
                                        <span class="font-medium">Last disconnected:</span> 
                                        {new Date(device.last_disconnected).toLocaleString()}
                                    </div>
                                {/if}
                                
                                {#if device.connection_count !== undefined}
                                    <div>
                                        <span class="font-medium">Connection count:</span> 
                                        {device.connection_count}
                                    </div>
                                {/if}
                            </div>
                            
                            {#if device.history && device.history.length > 0}
                                <div class="mt-3">
                                    <h5 class="text-sm font-medium mb-1">Recent History</h5>
                                    <div class="text-xs space-y-1 max-h-24 overflow-y-auto">
                                        {#each device.history as entry}
                                            <div class="flex">
                                                {#if entry.includes('online:')}
                                                    <Badge variant="default" class="mr-2">Online</Badge>
                                                {:else if entry.includes('offline:')}
                                                    <Badge variant="outline" class="mr-2">Offline</Badge>
                                                {/if}
                                                <span>
                                                    {entry.split(':')[1] ? new Date(entry.split(':')[1]).toLocaleString() : entry}
                                                </span>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </AdminCard>
    <!-- Publish Message Dialog -->
    <Dialog bind:open={showPublishDialog}>
        <DialogContent class="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle>Publish Message to Device</DialogTitle>
                <DialogDescription>
                    Send a message to device {selectedDeviceId} via Redis messages channel.
                    This will be relayed to the device through Pushpin.
                </DialogDescription>
            </DialogHeader>
            
            <div class="grid gap-4 py-4">
                <div class="grid gap-2">
                    <Label for="message">Message Content (JSON)</Label>
                    <Textarea
                        id="message"
                        bind:value={messageContent}
                        rows={8}
                        
                    />
                    <p class="text-xs text-muted-foreground">
                        Enter valid JSON that will be sent to the device.
                    </p>
                </div>
                
                {#if publishError}
                    <Alert variant="destructive">
                        <AlertDescription>{publishError}</AlertDescription>
                    </Alert>
                {/if}
            </div>
            
            <DialogFooter>
                <Button variant="outline" on:click={() => showPublishDialog = false}>Cancel</Button>
                <Button on:click={publishMessageToDevice} disabled={isPublishing}>
                    {#if isPublishing}
                        <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                    {:else}
                        <Send class="mr-2 h-4 w-4" />
                    {/if}
                    Publish
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    <!-- WebRTC Offer Dialog -->
    <Dialog bind:open={showWebRTCDialog}>
        <DialogContent class="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle>Send WebRTC Connect Request</DialogTitle>
                <DialogDescription>
                    Send a WebRTC connect request to device {webrtcDeviceId}.
                    This will initiate a WebRTC connection from the device.
                </DialogDescription>
            </DialogHeader>
            
            <div class="space-y-4 py-4">
                <div class="grid grid-cols-4 items-center gap-4">
                    <Label for="connection-id" class="text-right">Connection ID</Label>
                    <Input id="connection-id" class="col-span-3" bind:value={webrtcConnectionId} readonly />
                </div>
                
                {#if webrtcError}
                    <Alert variant="destructive">
                        <AlertDescription>{webrtcError}</AlertDescription>
                    </Alert>
                {/if}
            </div>
            
            <DialogFooter>
                <Button variant="outline" on:click={() => showWebRTCDialog = false}>Cancel</Button>
                <Button on:click={sendWebRTCOffer} disabled={isWebRTCPublishing}>
                    {#if isWebRTCPublishing}
                        <RefreshCw class="mr-2 h-4 w-4 animate-spin" />
                    {:else}
                        <Send class="mr-2 h-4 w-4" />
                    {/if}
                    Send Request
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</AdminPageLayout>
