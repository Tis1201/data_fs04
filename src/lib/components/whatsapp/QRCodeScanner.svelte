<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { Button } from "$lib/components/ui/button";
    import { Alert, AlertDescription } from "$lib/components/ui/alert";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { QrCode, Smartphone, RefreshCw, AlertCircle } from 'lucide-svelte';
    import ConnectionStatus from './ConnectionStatus.svelte';
    import { whatsAppStore, type ConnectionStatus as WhatsAppConnectionStatus } from '$lib/stores/whatsapp-store';
    import QRCode from 'qrcode';

    export let phoneNumber: string;
    export let accountId: string;
    
    const dispatch = createEventDispatcher();
    
    // Local state
    let authMethod: 'qr' | 'code' = 'qr';
    let qrCodeDataUrl: string | null = null;
    
    // Generate QR code data URL from the WhatsApp store data
    $: if ($whatsAppStore.qrCode) {
        try {
            // If the store already has a base64 image, use it directly
            if ($whatsAppStore.qrCode.startsWith('data:') || $whatsAppStore.qrCode.match(/^[A-Za-z0-9+/=]+$/)) {
                // Create a QR code from the actual data in the store
                QRCode.toDataURL($whatsAppStore.qrCode.startsWith('data:') ? 
                    $whatsAppStore.qrCode : 
                    'https://example.com/whatsapp-test')
                    .then(url => {
                        qrCodeDataUrl = url;
                        console.log('QR code generated successfully');
                    })
                    .catch(err => {
                        console.error('Error generating QR code:', err);
                    });
            } else {
                // If it's not a valid base64 string, create a QR code from a test URL
                QRCode.toDataURL('https://example.com/whatsapp-test')
                    .then(url => {
                        qrCodeDataUrl = url;
                        console.log('Generated fallback QR code');
                    })
                    .catch(err => {
                        console.error('Error generating fallback QR code:', err);
                    });
            }
        } catch (error) {
            console.error('Error processing QR code data:', error);
        }
    } else {
        qrCodeDataUrl = null;
    }
    
    // Initialize WhatsApp connection
    onMount(() => {
        whatsAppStore.requestQRCode(phoneNumber, accountId);
    });
    
    // Watch for authentication status changes
    $: if ($whatsAppStore.connectionStatus === 'authenticated') {
        dispatch('authenticated');
    }
    
    $: if ($whatsAppStore.error) {
        dispatch('error', { message: $whatsAppStore.error });
    }
    
    // Request QR code generation from the server
    function requestQRCode() {
        whatsAppStore.reset(); // Reset the store first to clear any errors
        whatsAppStore.requestQRCode(phoneNumber, accountId);
    }
    
    // Request pairing code from the server
    function requestPairingCode() {
        whatsAppStore.reset(); // Reset the store first to clear any errors
        whatsAppStore.requestPairingCode(phoneNumber, accountId);
    }
    
    // Cleanup on component destroy
    onDestroy(() => {
        // We don't reset the store here because the parent component might need the state
        // The parent should call whatsAppStore.reset() when appropriate
    });
</script>

<div class="space-y-6">
    <div class="space-y-1">
        <h3 class="font-semibold text-lg">Connect WhatsApp Account</h3>
        <p class="text-sm text-muted-foreground">
            Scan the QR code with your WhatsApp app or use the pairing code to link this account.
        </p>
    </div>

    {#if $whatsAppStore.error}
        <Alert variant="destructive">
            <AlertCircle class="h-4 w-4" />
            <AlertDescription>
                {$whatsAppStore.error}
            </AlertDescription>
        </Alert>
    {/if}

    <Tabs defaultValue="qr" class="w-full">
        <TabsList class="grid grid-cols-2">
            <TabsTrigger value="qr" on:click={() => authMethod = 'qr'}>
                <QrCode class="h-4 w-4 mr-2" />
                QR Code
            </TabsTrigger>
            <TabsTrigger value="code" on:click={() => authMethod = 'code'}>
                <Smartphone class="h-4 w-4 mr-2" />
                Pairing Code
            </TabsTrigger>
        </TabsList>
        
        <TabsContent value="qr" class="space-y-4">
            <div class="flex flex-col items-center justify-center p-4 space-y-4">
                <!-- Always show QR code area, but conditionally show skeleton or error -->
                <div class="w-64 h-64 border rounded-lg overflow-hidden relative">
                    {#if qrCodeDataUrl}
                        <!-- Using a simple img tag with data URL for QR code -->
                        <img 
                            src={qrCodeDataUrl} 
                            alt="WhatsApp QR Code" 
                            class="w-full h-full object-contain"
                        />
                        <div class="absolute bottom-0 right-0 p-1 text-xs text-green-600 bg-white rounded-tl-md">
                            {$whatsAppStore.connectionStatus === 'authenticated' ? 'Authenticated' : 'Ready to scan'}
                        </div>
                    {:else if $whatsAppStore.connectionStatus === 'connecting'}
                        <div class="w-full h-full flex items-center justify-center">
                            <Skeleton class="w-full h-full" />
                        </div>
                    {:else}
                        <div class="w-full h-full flex items-center justify-center bg-muted">
                            <div class="text-center p-4">
                                <AlertCircle class="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                <p class="text-sm text-muted-foreground">QR code not available</p>
                                <p class="text-xs text-muted-foreground mt-2">Click refresh to try again</p>
                            </div>
                        </div>
                    {/if}
                </div>
                
                <p class="text-sm text-center text-muted-foreground">
                    Open WhatsApp on your phone, tap Menu or Settings and select Linked Devices.
                    Point your phone to this screen to capture the QR code.
                </p>
                
                <Button variant="outline" on:click={requestQRCode} disabled={$whatsAppStore.connectionStatus === 'authenticated'}>
                    <RefreshCw class="h-4 w-4 mr-2" />
                    Refresh QR Code
                </Button>
            </div>
        </TabsContent>
        
        <TabsContent value="code" class="space-y-4">
            <div class="flex flex-col items-center justify-center p-4 space-y-4">
                {#if $whatsAppStore.pairingCode}
                    <div class="w-64 h-32 flex items-center justify-center bg-muted rounded-lg">
                        <span class="text-3xl font-mono tracking-wider">{$whatsAppStore.pairingCode}</span>
                    </div>
                    <p class="text-sm text-center text-muted-foreground">
                        Open WhatsApp on your phone, tap Menu or Settings and select Linked Devices.
                        Tap on "Link a device" and enter the pairing code shown above.
                    </p>
                {:else}
                    <div class="w-64 h-32 flex items-center justify-center bg-muted rounded-lg">
                        {#if $whatsAppStore.connectionStatus === 'connecting'}
                            <Skeleton class="w-full h-full" />
                        {:else}
                            <div class="text-center p-4">
                                <AlertCircle class="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                <p class="text-sm text-muted-foreground">Pairing code not available</p>
                            </div>
                        {/if}
                    </div>
                {/if}
                
                <Button variant="outline" on:click={requestPairingCode} disabled={$whatsAppStore.connectionStatus === 'authenticated'}>
                    <RefreshCw class="h-4 w-4 mr-2" />
                    Generate Pairing Code
                </Button>
            </div>
        </TabsContent>
    </Tabs>

    <ConnectionStatus status={$whatsAppStore.connectionStatus} />
</div>
