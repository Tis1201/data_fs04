<script lang="ts">
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import { Button } from "$lib/components/ui/button";
    import { Skeleton } from "$lib/components/ui/skeleton";
    import { ArrowLeft, RefreshCw, CheckCircle, Plus, QrCode, AlertTriangle } from "lucide-svelte";
    import AccountForm from "./form.svelte";
    import QRCode from "qrcode";
    import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
    import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
    import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
    import FormCard from "$lib/components/ui_components_sveltekit/form/FormCard.svelte";
    import FormActions from "$lib/components/ui_components_sveltekit/form/FormActions.svelte";
    import { whatsAppStore } from "$lib/stores/whatsapp-store";
    import type { ConnectionStatus } from "$lib/stores/whatsapp-store";
    import type { PageData } from "./$types";
    import { onDestroy, onMount } from "svelte";
    import { createFormHandler } from '$lib/components/ui_components_sveltekit/form/utils/formHandler';
    import { createClientMessage, type ClientMessage } from "$lib/types/messages";
    import { sseStore } from "$lib/stores/sse-store";
  
    export let data: PageData;
    const title = "Create WhatsApp Account";
  
    // Breadcrumbs for this page
    const pageCrumbs = [
      ["Admin", "/admin"],
      "Settings",
      ["Whatsapp", "/admin/settings/whatsapp/accounts"],
      "New Account",
    ];
  
    // Track the current step: 1 = Connect, 2 = Account Details, 3 = Success
    let currentStep = 1;
  
    // Account data after creation
    let createdAccount: { id?: string; description: string } | null = null;
    
    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    // Debug logging for WhatsApp store updates
    const unsubscribe = whatsAppStore.subscribe(($store) => {
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
      ($whatsAppStore.connectionStatus === "connected" || $whatsAppStore.connectionStatus === "authenticated")
    ) {
      console.log("[WHATSAPP_FORM] Connected status detected, preparing to advance to step 2");
      
      // Delay to ensure latest data from WhatsApp store
      setTimeout(() => {
        updateFormFromStore($whatsAppStore);
        console.log('[WHATSAPP_FORM] Using client ID for form:', $whatsAppStore.clientId);
        currentStep = 2;
        toast.success("WhatsApp connected successfully!");
      }, 500);
    }
  
    // Create form handler with validation and error handling
    const { form, errors, enhance, submitting, constraints, errorMessage } = createFormHandler(data.form, {
      validateOnInput: true,
      debugMode: true,
      action: "?/createAccount",
      onSubmit: ({ formData, formElement, action, cancel }) => {
        console.log('[WHATSAPP_FORM] Form submission started');
        
        // Validate client ID before submission
        const clientId = formData.get('client_id') || '';
        const isValidClientId = uuidRegex.test(clientId);
        
        if (!isValidClientId) {
          console.warn('[WHATSAPP_FORM] Invalid client ID format:', clientId);
          toast.error('Invalid client ID format. Please reconnect your WhatsApp account.');
          cancel();
          return;
        }
        
        console.log('[WHATSAPP_FORM] Form data:', {
          clientId: formData.get('client_id'),
          description: formData.get('description')
        });
      },
      onSuccess: (result) => {
        console.log('[WHATSAPP_FORM] Form submission success:', result);
        
        // Check for account data in the response
        // SuperForms now returns the form data at the top level with account attached
        if (result.data?.account) {
          createdAccount = {
            id: result.data.account.id,
            description: result.data.account.description,
          };
          
          currentStep = 3;
          toast.success("WhatsApp account created successfully");
        } else {
          // This should not happen with our updated server response
          console.warn('[WHATSAPP_FORM] Account data missing from success response:', result);
          toast.warning("Account created but details not available");
          
          // Still advance to success step even if account details are missing
          currentStep = 3;
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
        const url = await QRCode.toDataURL(qrCodeData, {
          errorCorrectionLevel: "H",
          margin: 1,
          width: 256,
          color: { dark: "#000000", light: "#FFFFFF" },
        });
        console.log("QR code generated successfully");
        return url;
      } catch (err) {
        console.error("Error generating QR code:", err);
        throw err;
      }
    }
  
    // Get background color class based on connection status
    function getStatusBgColor(status: ConnectionStatus): string {
      switch (status) {
        case "awaiting_scan": return "bg-amber-50 border border-amber-200";
        case "connecting": return "bg-blue-50 border border-blue-200";
        case "connected":
        case "authenticated": return "bg-green-50 border border-green-200";
        default: return "bg-red-50 border border-red-200";
      }
    }

    // Function to request a new QR code
    async function requestNewQRCode() {
        console.log('[WHATSAPP_FORM] Requesting new QR code...');
        
        // Update connection status to connecting
        whatsAppStore.update((state) => ({
            ...state,
            connectionStatus: 'connecting',
        }));

        // Wait for SSE to be connected
        const checkConnection = () => {
            return new Promise<void>((resolve, reject) => {
                const unsubscribe = sseStore.subscribe((state) => {
                    if (state.status === 'OPEN') {
                        unsubscribe();
                        resolve();
                    } else if (state.status === 'CLOSED' && state.error) {
                        unsubscribe();
                        reject(new Error('SSE connection failed'));
                    }
                });
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('SSE connection timeout'));
                }, 10000);
            });
        };

        try {
            // Ensure SSE is connected
            let currentStatus: string | null = null;
            const unsubscribe = sseStore.subscribe((state) => {
                currentStatus = state.status;
            });
            unsubscribe();

            if (currentStatus !== 'OPEN') {
                console.log('[WHATSAPP_FORM] SSE not open, connecting...');
                sseStore.connect('/api/sse', { withCredentials: true });
                await checkConnection();
            }

            console.log('[WHATSAPP_FORM] SSE connected, sending QR request...');
            
            // Use sendRequest to get a response
            const response = await sseStore.sendRequest(
                {
                    type: 'whatsapp',
                    scope: 'user:self',
                    payload: { action: 'request_qr' }
                },
                15000, // 15 second timeout
                'whatsapp_qr'
            );

            console.log('[WHATSAPP_FORM] QR code request sent successfully:', response);
        } catch (error) {
            console.error('[WHATSAPP_FORM] Failed to request QR code:', error);
            toast.error('Failed to request QR code. Please try again.');
            whatsAppStore.update((state) => ({
                ...state,
                connectionStatus: 'disconnected',
            }));
        }
    }

    // Request QR code on mount, but wait a bit for SSE to connect
    onMount(() => {
        // Ensure SSE is connected
        sseStore.connect('/api/sse', { withCredentials: true });
        
        // Wait a bit for SSE to connect, then request QR code
        setTimeout(() => {
            requestNewQRCode();
        }, 500);
    });
  </script>
  
  <PageContainer crumbs={pageCrumbs}>
    <PageHeader title={title} />
    <PageContent>
      {#if currentStep === 1}
        <!-- Step 1: QR Code Display -->
        <FormCard title="Connect WhatsApp" description="Scan the QR code with your WhatsApp app to connect this account.">
          <div class="flex flex-col items-center justify-center space-y-4 p-4">
            <!-- Connection status display -->
            <div class="mb-4 p-3 rounded-md w-full flex items-center gap-2 {getStatusBgColor($whatsAppStore.connectionStatus)}">
              {#if $whatsAppStore.connectionStatus === 'awaiting_scan'}
                <QrCode class="h-5 w-5 text-amber-600" />
                <div>
                  <p class="text-sm font-medium">Waiting for QR code scan</p>
                  <p class="text-xs text-muted-foreground">Please scan the QR code with your WhatsApp app</p>
                </div>
              {:else if $whatsAppStore.connectionStatus === 'connecting'}
                <RefreshCw class="h-5 w-5 text-blue-600 animate-spin" />
                <div>
                  <p class="text-sm font-medium">Connecting</p>
                  <p class="text-xs text-muted-foreground">Establishing connection to WhatsApp...</p>
                </div>
              {:else if $whatsAppStore.connectionStatus === 'connected'}
                <CheckCircle class="h-5 w-5 text-green-600" />
                <div>
                  <p class="text-sm font-medium">Connected</p>
                  <p class="text-xs text-muted-foreground">WhatsApp connection established</p>
                </div>
              {:else if $whatsAppStore.connectionStatus === 'authenticated'}
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
  
            {#if $whatsAppStore.qrCode}
              <!-- Display the generated QR code -->
              <div class="w-64 h-64 border border-border rounded-md overflow-hidden flex items-center justify-center bg-white">
                {#await generateQRCode($whatsAppStore.qrCode)}
                  <Skeleton class="h-64 w-64" />
                {:then qrCodeUrl}
                  <img src={qrCodeUrl} alt="WhatsApp QR Code" class="w-full h-full object-contain" />
                {:catch error}
                  <div class="text-center text-destructive">
                    <AlertTriangle class="h-12 w-12 mx-auto mb-2" />
                    <p class="text-sm">Failed to generate QR code</p>
                  </div>
                {/await}
              </div>
              <p class="text-sm text-center text-muted-foreground">Scan this QR code with your WhatsApp app to connect</p>
            {:else if $whatsAppStore.connectionStatus === 'connecting'}
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
            <!-- Button to manually request QR code -->
            {#if !$whatsAppStore.qrCode && $whatsAppStore.connectionStatus !== 'connecting'}
              <Button variant="outline" size="sm" on:click={requestNewQRCode}>
                <RefreshCw class="h-4 w-4 mr-2" />
                Request QR Code
              </Button>
            {/if}
            {#if $whatsAppStore.connectionStatus === 'connected' || $whatsAppStore.connectionStatus === 'authenticated'}
              <Button variant="default" on:click={() => {
                updateFormFromStore($whatsAppStore);
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
            <div class="bg-muted/40 p-4 rounded-lg border border-muted">
              <h4 class="text-sm font-medium mb-2">Debug Info</h4>
              <p class="text-xs text-muted-foreground">Current Step: {currentStep}</p>
              <p class="text-xs text-muted-foreground">Account ID: {createdAccount?.id || 'Not available'}</p>
            </div>
            <FormActions>
              <Button variant="outline" on:click={() => goto('/admin/settings/whatsapp/accounts')}>
                <ArrowLeft class="h-4 w-4 mr-2" />
                Back to Accounts
              </Button>
            </FormActions>
          </div>
        </FormCard>
      {/if}
    </PageContent>
  </PageContainer>
  