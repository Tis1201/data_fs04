<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { ArrowLeft, RefreshCw, CheckCircle, QrCode, AlertTriangle } from "lucide-svelte";
    import AccountForm from "./form.svelte";
    import QRCode from "qrcode";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import { whatsAppSSEStore } from "$lib/stores/whatsapp-sse-store";
    import type { ConnectionStatus } from "$lib/stores/whatsapp-sse-store";
    import type { PageData } from "./$types";
    import { onDestroy, onMount } from "svelte";
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import { sseStore } from "$lib/stores/sse-store";
  
    export let data: PageData;
    const title = "Create WhatsApp Account";
  
    // Breadcrumbs for this page
    const pageCrumbs = [
      ["User", "/user"],
      ["Integrations", "/user/integrations"],
      ["WhatsApp", "/user/integrations/whatsapp/accounts"],
      "New Account",
    ];
  
    // Track the current step: 1 = Connect, 2 = Account Details, 3 = Success
    let currentStep = 1;
  
    // Account data after creation
    let createdAccount: { id?: string; description: string } | null = null;
    
    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Debug logging for WhatsApp store updates
    const unsubscribe = whatsAppSSEStore.subscribe(($store) => {
      console.log('[WHATSAPP_FORM] Store update:', { 
        clientId: $store.clientId, 
        displayName: $store.displayName,
        phoneNumber: $store.phoneNumber,
        connectionStatus: $store.connectionStatus,
        hasQrCode: $store.qrCode ? true : false
      });
    });
    onDestroy(unsubscribe);
  
    // Helper function to update form values from store
    function updateFormFromStore($store) {
      if (!$store) return;
      
      const clientId = $store.clientId || "";
      const isValidClientId = uuidRegex.test(clientId);
      
      console.log('[WHATSAPP_FORM] Updating form with values:', {
        displayName: $store.displayName,
        phoneNumber: $store.phoneNumber,
        clientId,
        isValidClientId
      });
      
      if (!isValidClientId) {
        console.warn('[WHATSAPP_FORM] Invalid client ID format:', clientId);
      }
      
      $form.name = $store.displayName || "Unknown";
      $form.phoneNumber = $store.phoneNumber || "";
      $form.client_id = clientId;
      $form.description = `WhatsApp Account - ${$form.name}`;
    }
  
    // Log step changes
    $: console.log(`[WHATSAPP_FORM] Step changed to: ${currentStep}`);
    
    // Auto-advance to step 2 when connected
    $: if (
      currentStep === 1 &&
      ($whatsAppSSEStore.connectionStatus === "connected" || $whatsAppSSEStore.connectionStatus === "authenticated")
    ) {
      console.log("[WHATSAPP_FORM] Connected status detected, preparing to advance to step 2");
      
      // Delay to ensure latest data from WhatsApp store
      setTimeout(() => {
        updateFormFromStore($whatsAppSSEStore);
        console.log('[WHATSAPP_FORM] Using client ID for form:', $whatsAppSSEStore.clientId);
        currentStep = 2;
        toast.success("WhatsApp connected successfully!");
      }, 500);
    }
  
    // Create form handler with validation and error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
      validateOnInput: true,
      debugMode: true,
      action: "?/createAccount",
      onSubmit: (formData) => {
        // Check if we have a valid client ID before submitting
        const clientId = formData.get('client_id');
        if (!clientId || !uuidRegex.test(clientId.toString())) {
          console.error('[WHATSAPP_FORM] Invalid client ID:', clientId);
          toast.error("WhatsApp connection required. Please scan the QR code first.");
          return false;
        }
        
        console.log('[WHATSAPP_FORM] Form data:', {
          clientId: formData.get('client_id'),
          description: formData.get('description')
        });
      },
      onSuccess: (result) => {
        console.log('[WHATSAPP_FORM] Form submission success:', result);
        
        // Check for account data in the response
        if (result.account) {
          createdAccount = result.account;
          currentStep = 3;
          toast.success("WhatsApp account created successfully!");
        } else {
          console.warn('[WHATSAPP_FORM] Account data not found in response:', result);
          toast.success(result.form?.message || "WhatsApp account created successfully!");
          // Navigate back to accounts list if we don't have account data for the success page
          goto('/user/integrations/whatsapp/accounts');
        }
      },
      onError: (result) => {
        console.error('[WHATSAPP_FORM] Form submission error:', result);
        toast.error(result.form?.message || "Failed to create WhatsApp account");
        
        if (result.form?.errors) {
          console.error('[WHATSAPP_FORM] Validation errors:', result.form.errors);
        }
      },
    });
  
    // Generate QR code from data
    async function generateQRCode(qrCodeData: string) {
      if (!qrCodeData) return null;
      
      console.log("Generating QR code from data:", qrCodeData.substring(0, 20) + "...");
      
      try {
        const qrCodeUrl = await QRCode.toDataURL(qrCodeData, {
          margin: 1,
          width: 256,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        return qrCodeUrl;
      } catch (err) {
        console.error("Failed to generate QR code:", err);
        return null;
      }
    }
    
    // Helper function to get status background color
    function getStatusBgColor(status: ConnectionStatus): string {
      switch (status) {
        case 'awaiting_scan':
          return 'bg-amber-50';
        case 'connected':
        case 'authenticated':
          return 'bg-green-50';
        case 'connecting':
          return 'bg-blue-50';
        default:
          return 'bg-red-50';
      }
    }
    
    // Function to request a new QR code
    function requestNewQRCode() {
        whatsAppSSEStore.requestQRCode();
    }

    // Initialize SSE connection
    onMount(async () => {
        // Connect to SSE endpoint
        sseStore.connect('/api/sse');
        
        // Setup event listeners
        whatsAppSSEStore.setupEventListeners();
        
        // Request QR code
        setTimeout(() => {
            requestNewQRCode();
        }, 500);
    });
    
    onDestroy(() => {
        // Clean up SSE connection
        sseStore.disconnect();
    });
</script>

<UserPageLayout 
    title={title}
    crumbs={pageCrumbs}
>
    <div class="max-w-3xl mx-auto">
        {#if currentStep === 1}
            <!-- Step 1: QR Code Display -->
            <FormCard title="Connect WhatsApp" description="Scan the QR code with your WhatsApp app to connect this account.">
                <div class="flex flex-col items-center justify-center space-y-4 p-4">
                    <!-- Connection status display -->
                    <div class="mb-4 p-3 rounded-md w-full flex items-center gap-2 {getStatusBgColor($whatsAppSSEStore.connectionStatus)}">
                        {#if $whatsAppSSEStore.connectionStatus === 'awaiting_scan'}
                            <QrCode class="h-5 w-5 text-amber-600" />
                            <div>
                                <p class="text-sm font-medium">Waiting for QR code scan</p>
                                <p class="text-xs text-muted-foreground">Scan the QR code with your WhatsApp app</p>
                            </div>
                        {:else if $whatsAppSSEStore.connectionStatus === 'connecting'}
                            <RefreshCw class="h-5 w-5 text-blue-600 animate-spin" />
                            <div>
                                <p class="text-sm font-medium">Connecting</p>
                                <p class="text-xs text-muted-foreground">Establishing connection to WhatsApp</p>
                            </div>
                        {:else if $whatsAppSSEStore.connectionStatus === 'connected'}
                            <CheckCircle class="h-5 w-5 text-green-600" />
                            <div>
                                <p class="text-sm font-medium">Connected</p>
                                <p class="text-xs text-muted-foreground">Successfully connected to WhatsApp</p>
                            </div>
                        {:else if $whatsAppSSEStore.connectionStatus === 'authenticated'}
                            <CheckCircle class="h-5 w-5 text-green-600" />
                            <div>
                                <p class="text-sm font-medium">Authenticated</p>
                                <p class="text-xs text-muted-foreground">Successfully authenticated with WhatsApp</p>
                            </div>
                        {:else}
                            <AlertTriangle class="h-5 w-5 text-red-600" />
                            <div>
                                <p class="text-sm font-medium">Disconnected</p>
                                <p class="text-xs text-muted-foreground">Not connected to WhatsApp</p>
                            </div>
                        {/if}
                    </div>

                    {#if $whatsAppSSEStore.qrCode}
                        <!-- Display the generated QR code -->
                        <div class="w-64 h-64 border border-border rounded-md overflow-hidden flex items-center justify-center bg-white">
                            {#await generateQRCode($whatsAppSSEStore.qrCode)}
                                <div class="flex flex-col items-center justify-center">
                                    <Skeleton class="h-64 w-64" />
                                </div>
                            {:then qrCodeUrl}
                                {#if qrCodeUrl}
                                    <img src={qrCodeUrl} alt="WhatsApp QR Code" class="w-64 h-64" />
                                {:else}
                                    <div class="text-center">
                                        <p class="text-sm">Failed to generate QR code</p>
                                    </div>
                                {/if}
                            {/await}
                        </div>
                        <p class="text-sm text-center text-muted-foreground">Scan this QR code with your WhatsApp app to connect</p>
                    {:else if $whatsAppSSEStore.connectionStatus === 'connecting'}
                        <div class="w-64 h-64 flex items-center justify-center">
                            <Skeleton class="h-64 w-64" />
                        </div>
                        <Skeleton class="h-4 w-48" />
                    {:else}
                        <div class="w-64 h-64 border-2 border-dashed border-muted-foreground rounded-md flex items-center justify-center">
                            <div class="text-center">
                                <QrCode class="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                <p class="text-sm text-muted-foreground">QR code not available</p>
                            </div>
                        </div>
                        <p class="text-sm text-center text-muted-foreground">Click the button below to request a QR code</p>
                    {/if}
                </div>

                <div class="mt-4 flex flex-col gap-2">
                    <Button variant="outline" size="sm" on:click={requestNewQRCode}>
                        <RefreshCw class="h-4 w-4 mr-2" />
                        Request New QR Code
                    </Button>
                    
                    {#if $whatsAppSSEStore.connectionStatus === 'connected' || $whatsAppSSEStore.connectionStatus === 'authenticated'}
                        <Button variant="default" on:click={() => {
                            updateFormFromStore($whatsAppSSEStore);
                            currentStep = 2;
                        }}>
                            <CheckCircle class="h-4 w-4 mr-2" />
                            Continue to Account Details
                        </Button>
                    {/if}
                </div>
            </FormCard>
        {:else if currentStep === 2}
            <!-- Step 2: Account Details -->
            <AccountForm 
                form={$form}
                errors={$errors}
                enhance={enhance}
                submitting={$submitting}
                constraints={$constraints}
                errorMessage={$errorMessage}
                on:goBack={() => currentStep = 1}
            />
        {:else if currentStep === 3}
            <!-- Step 3: Success -->
            {#key currentStep}
                <div on:mount={() => console.log('[WHATSAPP_FORM] Success step mounted with account:', createdAccount)}></div>
            {/key}
            <FormCard title="Account Created Successfully" description="Your WhatsApp account has been created successfully.">
                <div class="space-y-6">
                    <div class="bg-muted/40 p-4 rounded-lg border border-muted">
                        <h4 class="text-sm font-medium mb-2">Account Details</h4>
                        <div class="space-y-2">
                            <CheckCircle class="h-6 w-6 text-green-500" />
                            <div>
                                <p class="text-xs text-muted-foreground">Description</p>
                                {#if createdAccount?.description}
                                    <p class="text-sm">{createdAccount.description}</p>
                                {:else}
                                    <p class="text-sm text-yellow-500">Account created but description not available</p>
                                    <Skeleton class="h-4 w-48" />
                                {/if}
                            </div>
                        </div>
                    </div>
                    <FormActions>
                        <Button variant="outline" on:click={() => goto('/user/integrations/whatsapp/accounts')}>
                            <ArrowLeft class="h-4 w-4 mr-2" />
                            Back to Accounts
                        </Button>
                    </FormActions>
                </div>
            </FormCard>
        {/if}
    </div>
</UserPageLayout>
