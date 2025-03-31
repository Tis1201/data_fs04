<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { ArrowLeft, RefreshCw, CheckCircle, Plus, QrCode, AlertTriangle } from "lucide-svelte";
    import QRCode from "qrcode";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormContainer from "$lib/components/ui_components_sveltekit/form/FormContainer.svelte";
    import FormRow from "$lib/components/ui_components_sveltekit/form/FormRow.svelte";
    import FormField from "$lib/components/ui_components_sveltekit/form/FormField.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import QRCodeDisplay from "$lib/components/ui_components_sveltekit/whatsapp/QRCodeDisplay.svelte";
    import { whatsAppStore } from "$lib/stores/whatsapp-store";
    import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "$lib/components/ui/card";
    import type { PageData } from './$types';
    
    // Import the reusable form handler
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    
    export let data: PageData;
    const title = "Create WhatsApp Account";

    // Define breadcrumbs for this page
    const pageCrumbs = [
        ["Admin", "/admin"],
        ["Settings", "/admin/settings"],
        ["WhatsApp Accounts", "/admin/settings/whatsapp/accounts"],
        "New Account",
    ];
    
    // Track the current step in the account creation process
    let currentStep = 1; // 1: Connect WhatsApp, 2: Account Details, 3: Success
    
    // Account data after creation
    let createdAccount: { id?: string; description: string } | null = null;
    
    // Use the tempClientId from the server
    let tempClientId = data.tempClientId;

    // Create a form handler with standardized error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
        validateOnInput: true,
        debugMode: true,
        onSuccess: (result) => {
            if (result.data?.account) {
                createdAccount = {
                    id: result.data.account.id,
                    description: result.data.account.description
                };
                
                // Move to success page
                currentStep = 3;
                toast.success("WhatsApp account created successfully");
            }
        }
    });

    // Handle QR code display events
    function handleAuthenticated(event: CustomEvent) {
        // Use the real phone information from the WhatsApp client
        const pushName = event.detail?.pushName || $whatsAppStore.pushName || 'Unknown';
        const clientId = event.detail?.clientId || $whatsAppStore.clientId || '';

        // Update form with WhatsApp info
        form.data.description = `WhatsApp Account - ${pushName}`;
        form.data.client_id = clientId;

        // Move to account details step
        currentStep = 2;
    }
    
    // Handle QR code refresh request from QRCodeDisplay
    function handleRefreshQRCode(event: CustomEvent) {
        console.log('Refresh QR code requested:', event.detail);
        handleQRCodeRequest(); // Reuse existing function
    }
    
    // Handle pairing code request from QRCodeDisplay
    function handlePairingCodeRequest(event: CustomEvent) {
        console.log('Pairing code requested:', event.detail);
        
        // Reset the store first to clear any errors
        whatsAppStore.reset();
        
        // Request pairing code using the store method
        whatsAppStore.requestPairingCode(event.detail.accountId);
        
        toast.success('Requesting pairing code...');
    }
    
    // Handle error events from QRCodeDisplay
    function handleError(event: CustomEvent) {
        console.error('WhatsApp error:', event.detail);
        toast.error(event.detail.message || 'An error occurred');
    }
    
    // Generate QR code from data
    async function generateQRCode(qrCodeData: string) {
        if (!qrCodeData) {
            console.log('No QR code data available');
            return null;
        }
        
        console.log('Generating QR code from data:', qrCodeData.substring(0, 20) + '...');
        
        try {
            // Use QRCode library to generate a data URL
            const url = await QRCode.toDataURL(qrCodeData, {
                errorCorrectionLevel: 'H', // High error correction for better scanning
                margin: 1,
                width: 256,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            console.log('QR code generated successfully');
            return url;
        } catch (err) {
            console.error('Error generating QR code:', err);
            throw err;
        }
    }

    // Handle QR code request
    function handleQRCodeRequest() {
        try {
            // Reset the WhatsApp store to clear any previous state
            whatsAppStore.reset();
            
            // Generate a new temporary client ID
            tempClientId = `temp-${crypto.randomUUID()}`;
            
            // Set the account ID in the store
            whatsAppStore.setAccountId(tempClientId);
            
            // Set the store to connecting state
            whatsAppStore.setConnectionStatus('connecting');
            
            // The QR code will be automatically requested via WebSocket
            // when the QRCodeDisplay component is mounted with the new tempClientId
            
            // Show loading state while waiting for QR code via WebSocket
            toast.success('Requesting new QR code...');
            
            // Send a WebSocket message to request a QR code
            import('$lib/stores/websocket-store').then(({ socketStore }) => {
                // Ensure WebSocket is connected
                if (socketStore.status !== 'OPEN') {
                    socketStore.connect();
                }
                
                // Send the request via WebSocket
                socketStore.send({
                    type: 'whatsapp',
                    action: 'requestQRCode',
                    data: {
                        accountId: tempClientId
                    }
                });
                
                console.log('QR code request sent via WebSocket');
            });
        } catch (error) {
            console.error('Error requesting QR code:', error);
            toast.error('Failed to request QR code. Please try again.');
        }
    }
</script>

<PageContainer crumbs={pageCrumbs}>
    <PageHeader title={title} />

    <PageContent>
        {#if currentStep === 1}
            <!-- QR Code Display Step -->
            <FormCard title="Connect WhatsApp" description="Scan the QR code with your WhatsApp app to connect this account.">
                <!-- Simple QR code display -->
                <div class="flex flex-col items-center justify-center space-y-4 p-4">
                    {#if $whatsAppStore.qrCode}
                        <!-- Show QR code when available -->
                        <div class="w-64 h-64 border border-border rounded-md overflow-hidden flex items-center justify-center bg-white">
                            {#await generateQRCode($whatsAppStore.qrCode)}
                                <!-- Loading state while generating QR code -->
                                <div class="animate-pulse">
                                    <QrCode class="h-24 w-24 text-muted-foreground" />
                                </div>
                            {:then qrCodeUrl}
                                <!-- QR code image -->
                                <img 
                                    src={qrCodeUrl} 
                                    alt="WhatsApp QR Code" 
                                    class="w-full h-full object-contain"
                                />
                            {:catch error}
                                <!-- Error state -->
                                <div class="text-center text-destructive">
                                    <AlertTriangle class="h-12 w-12 mx-auto mb-2" />
                                    <p class="text-sm">Failed to generate QR code</p>
                                </div>
                            {/await}
                        </div>
                        <p class="text-sm text-center text-muted-foreground">
                            Scan this QR code with your WhatsApp app to connect
                        </p>
                    {:else if $whatsAppStore.connectionStatus === 'connecting'}
                        <!-- Loading state when connecting -->
                        <div class="w-64 h-64 flex items-center justify-center">
                            <Skeleton class="h-64 w-64" />
                        </div>
                        <Skeleton class="h-4 w-48" />
                    {:else}
                        <!-- No QR code available state -->
                        <div class="w-64 h-64 border-2 border-dashed border-muted-foreground rounded-md flex items-center justify-center">
                            <div class="text-center">
                                <QrCode class="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                <p class="text-sm text-muted-foreground">QR code not available</p>
                            </div>
                        </div>
                        <p class="text-sm text-center text-muted-foreground">
                            Click the button below to request a QR code
                        </p>
                    {/if}
                </div>
                    
                <div class="mt-4">
                    <Button 
                        variant="outline" 
                        on:click={handleQRCodeRequest}
                        disabled={$whatsAppStore.connectionStatus === 'connecting'}
                    >
                        <RefreshCw class="h-4 w-4 mr-2" />
                        Request New QR Code
                    </Button>
                </div>
            </FormCard>
        {:else if currentStep === 2}
            <!-- Step 2: Account Details -->
            <FormContainer 
                method="POST" 
                action="?/default" 
                {enhance} 
                novalidate 
                errorMessage={$errorMessage}
            >
                <FormCard title="Account Details" description="Enter account information.">
                    <FormRow columns={1}>
                        <FormField id="description" label="Description" error={$errors.description}>
                            {#if form.data.description}
                                <Textarea
                                    id="description"
                                    name="description"
                                    bind:value={$form.description}
                                    placeholder="Describe this WhatsApp account"
                                    aria-invalid={$errors.description ? 'true' : undefined}
                                    {...$constraints.description}
                                />
                            {:else}
                                <Skeleton class="h-24 w-full" />
                            {/if}
                        </FormField>
                    </FormRow>
                    
                    <FormRow columns={1}>
                        <FormField id="client_id" label="Client ID" error={$errors.client_id}>
                            {#if form.data.client_id}
                                <Input
                                    id="client_id"
                                    name="client_id"
                                    bind:value={$form.client_id}
                                    disabled
                                    aria-invalid={$errors.client_id ? 'true' : undefined}
                                    {...$constraints.client_id}
                                />
                            {:else}
                                <Skeleton class="h-10 w-full" />
                            {/if}
                        </FormField>
                    </FormRow>

                    <FormActions>
                        <Button
                            type="button"
                            variant="outline"
                            on:click={() => currentStep = 1}
                            disabled={$submitting}
                        >
                            Back
                        </Button>
                        <Button type="submit" disabled={$submitting} class="min-w-[120px] relative">
                            {#if $submitting}
                                <span class="absolute inset-0 flex items-center justify-center">
                                    <Skeleton class="h-4 w-20" />
                                </span>
                                <span class="opacity-0">Create Account</span>
                            {:else}
                                <Plus class="h-4 w-4 mr-2" />
                                Create Account
                            {/if}
                        </Button>
                    </FormActions>
                </FormCard>
            </FormContainer>
        {:else if currentStep === 3}
            <!-- Step 3: Success Page -->
            <FormCard title="Account Created Successfully" description="Your WhatsApp account has been created successfully.">
                <div class="space-y-6">
                    <div class="flex items-center gap-4">
                        <CheckCircle class="h-6 w-6 text-green-500" />
                        <div>
                            <p class="font-medium">Account Created</p>
                            <p class="text-sm text-muted-foreground">Your WhatsApp account has been created successfully.</p>
                        </div>
                    </div>
                    
                    <div class="bg-muted/40 p-4 rounded-lg border border-muted">
                        <h4 class="text-sm font-medium mb-2">Account Details</h4>
                        <div class="space-y-2">
                            <div>
                                <p class="text-xs text-muted-foreground">Description</p>
                                {#if createdAccount?.description}
                                    <p class="text-sm">{createdAccount.description}</p>
                                {:else}
                                    <Skeleton class="h-4 w-48" />
                                {/if}
                            </div>
                        </div>
                    </div>

                    <FormActions>
                        <Button 
                            variant="outline" 
                            on:click={() => goto('/admin/settings/whatsapp/accounts')}
                        >
                            <ArrowLeft class="h-4 w-4 mr-2" />
                            Back to Accounts
                        </Button>
                    </FormActions>
                </div>
            </FormCard>
        {/if}
    </PageContent>
</PageContainer>
