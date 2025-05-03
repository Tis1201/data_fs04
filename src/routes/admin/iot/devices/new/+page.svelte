<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { AlertTriangle, CheckCircle, ArrowLeft } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import PageContainer from "$lib/components/ui_components_sveltekit/layout/PageContainer.svelte";
  import PageHeader from "$lib/components/ui_components_sveltekit/layout/PageHeader.svelte";
  import PageContent from "$lib/components/ui_components_sveltekit/layout/PageContent.svelte";
  import ActionButton from "$lib/components/ui_components_sveltekit/buttons/ActionButton.svelte";
  import { deviceStore } from "$lib/stores/device-store";
  import type { PageData } from "./$types";
  
  // Import page data
  export let data: PageData;
  
  // Page title and breadcrumbs
  const title = "Claim Device";
  const pageCrumbs = [
    ["Admin", "/admin"],
    ["IoT", "/admin/iot"],
    ["Devices", "/admin/iot/devices"],
    "Claim Device",
  ];
  
  // Form state
  let pinCode = "";
  let submitting = false;
  let claimError = "";
  let claimedDevice: any = null;
  
  // Handle form submission
  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    // Validate PIN before submitting
    if (!pinCode) {
      toast.error("Please enter a PIN code");
      return;
    }
    if (pinCode.length < 6) {
      toast.error("PIN code must be 6 digits");
      return;
    }
    
    submitting = true;
    deviceStore.setClaimStatus("claiming");
    claimError = "";
    
    try {
      const formData = new FormData();
      formData.append("pin", pinCode);
      
      const response = await fetch("?/claimDevice", {
        method: "POST",
        body: formData
      });
      
      const result = await response.json();
      // Log the complete server response for debugging
      console.log('Server response:', JSON.stringify(result, null, 2));
      
      if (result.success === false) {
        // The server's error structure is: { success: false, message: { details: string, ... } }
        console.log('Error message object:', result.message);
        
        // Extract the detailed error message - based on server structure from +page.server.ts
        // The actual error message is in result.message.details
        let errorMessage;
        
        if (result.message && typeof result.message === 'object' && 'details' in result.message) {
          // This is the expected structure from the server
          errorMessage = result.message.details;
          console.log('Found error details:', errorMessage);
        } else if (typeof result.message === 'string') {
          // Fallback if message is a direct string
          errorMessage = result.message;
        } else {
          // Generic fallback message
          errorMessage = "The device could not be claimed. Please try again with a different PIN.";
        }
        
        // Update the UI with the error message
        claimError = errorMessage;
        deviceStore.setClaimStatus("failed", errorMessage);
        toast.error("Verification Failed");
      } else {
        // Handle success
        claimedDevice = result.device;
        deviceStore.updateDevice({
          deviceId: result.device.id,
          name: result.device.name,
          deviceType: result.device.deviceType,
          status: result.device.status,
          claimStatus: "claimed"
        });
        toast.success("Device claimed successfully!");
      }
    } catch (error) {
      console.error("Error claiming device:", error);
      
      // Only show the connection error if it's truly a network error
      // If we have a more specific error message, use that instead
      if (error instanceof TypeError && error.message.includes('fetch')) {
        claimError = "Connection error. Please check your network and try again.";
        toast.error("Connection Error");
      } else {
        // For other errors, provide a more generic but still helpful message
        claimError = "An error occurred while claiming the device. Please try again.";
        toast.error("Verification Failed");
      }
      
      deviceStore.setClaimStatus("failed", claimError);
    } finally {
      submitting = false;
    }
  }
  
  // If the device is claimed while we're on this page, update the claimedDevice variable
  onMount(() => {
    const unsubscribe = deviceStore.subscribe(state => {
      if (state.claimStatus === 'claimed' && state.deviceId) {
        claimedDevice = {
          id: state.deviceId,
          name: state.name,
          deviceType: state.deviceType,
          status: state.status || 'ACTIVE'
        };
      }
    });
    
    return () => {
      unsubscribe();
      // Reset device store when component is destroyed
      deviceStore.reset();
    };
  });
  </script>
  
  <PageContainer crumbs={pageCrumbs}>
    <PageHeader title={title}>
      <svelte:fragment slot="action">
        <ActionButton
          label="Back to Devices"
          icon={ArrowLeft}
          onClick={() => goto("/admin/iot/devices")}
          variant="outline"
        />
      </svelte:fragment>
    </PageHeader>
  
    <PageContent>
      {#if !claimedDevice}
        <!-- Step 1: Enter PIN Code -->
        <Card class="border-0 shadow-md">
          <CardContent class="pt-6">
          <div class="flex flex-col items-center justify-center space-y-4 p-4">
            <!-- Status display -->
            {#if claimError}
              <!-- Error state takes precedence -->
              <div class="mb-4 p-4 rounded-md w-full flex items-center gap-3 bg-destructive/10 border border-destructive/20 text-destructive">
                <div class="h-10 w-10 flex-shrink-0 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle class="h-5 w-5" />
                </div>
                <div class="w-full">
                  <p class="font-medium">Verification Failed</p>
                  <p class="text-sm">{claimError}</p>
                </div>
              </div>
            {:else if $deviceStore.claimStatus === 'claiming'}
              <!-- Loading state -->
              <div class="mb-4 p-4 rounded-md w-full flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800">
                <div class="h-10 w-10 flex-shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
                  <div class="h-5 w-5">
                    <Skeleton class="h-5 w-5 rounded-full" />
                  </div>
                </div>
                <div>
                  <p class="font-medium">Claiming device...</p>
                  <p class="text-sm">Please wait while we verify the PIN code</p>
                </div>
              </div>
            {/if}

            <!-- PIN input form -->
            <div class="w-full max-w-md">
              <form method="POST" class="space-y-6" on:submit={handleSubmit}>
                <div class="space-y-2">
                  <Label for="pin" class="text-base">Device PIN Code <span class="text-destructive">*</span></Label>
                  <div class="flex justify-center">
                    <Input
                      id="pin"
                      type="text"
                      name="pin"
                      placeholder="Enter 6-digit PIN"
                      bind:value={pinCode}
                      class="text-center text-lg tracking-widest font-mono"
                      maxlength="6"
                      disabled={submitting || $deviceStore.claimStatus === 'claiming'}
                      autocomplete="off"
                    />
                  </div>
                  <p class="text-xs text-muted-foreground text-center mt-1">
                    Enter the 6-digit PIN displayed on your device
                  </p>
                </div>

                <div class="flex justify-center pt-4">
                  <div class="w-full space-y-2">
                    <Button
                      type="submit"
                      disabled={!pinCode || pinCode.length < 6 || submitting || $deviceStore.claimStatus === 'claiming'}
                      class="w-full relative h-11"
                      size="lg"
                    >
                      {#if submitting}
                        <span class="absolute inset-0 flex items-center justify-center">
                          <Skeleton class="h-5 w-28" />
                        </span>
                        <span class="opacity-0">Claim Device</span>
                      {:else}
                        Claim Device
                      {/if}
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            <!-- Help Text -->
            <div class="w-full mt-6 p-4 rounded-md border bg-muted/10">
              <h3 class="text-sm font-medium mb-2 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4 mr-2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                Need help finding your device PIN?
              </h3>
              <ul class="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>The PIN is a 6-digit code displayed on your device or terminal during setup</li>
                <li>For camera devices, the PIN may appear on the device's screen</li>
                <li>If you can't find the PIN, try resetting the device</li>
              </ul>
            </div>
          </div>

         
          </CardContent>
        </Card>
      {:else}
        <!-- Success View -->
        <Card class="border-0 shadow-md">
          <CardHeader class="pb-4 border-b">
            <CardTitle class="text-xl">Device Claimed Successfully</CardTitle>
            <CardDescription>Your device has been claimed and is ready to use.</CardDescription>
          </CardHeader>
          <CardContent class="pt-6">
          <div class="space-y-6">
            <div class="mb-4 p-3 rounded-md w-full flex items-center gap-2 bg-green-100 text-green-800">
              <CheckCircle class="h-5 w-5" />
              <div>
                <p class="text-sm font-medium">Device Claimed Successfully</p>
                <p class="text-xs">Your device has been successfully claimed and is ready to use.</p>
              </div>
            </div>

            <div class="bg-muted/40 p-4 rounded-lg border border-muted">
              <h4 class="text-sm font-medium mb-2">Device Details</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1">
                  <p class="text-xs text-muted-foreground">Device ID</p>
                  <p class="text-sm font-mono break-all">{claimedDevice.id}</p>
                </div>

                <div class="space-y-1">
                  <p class="text-xs text-muted-foreground">Name</p>
                  <p class="text-sm">{claimedDevice?.name || 'N/A'}</p>
                </div>

                <div class="space-y-1">
                  <p class="text-xs text-muted-foreground">Type</p>
                  <p class="text-sm">{claimedDevice?.deviceType || 'N/A'}</p>
                </div>

                <div class="space-y-1">
                  <p class="text-xs text-muted-foreground">Status</p>
                  <div class="flex items-center">
                    <span
                      class="inline-block w-2 h-2 rounded-full mr-2 {claimedDevice?.status === 'ACTIVE' ? 'bg-green-500' : 'bg-amber-500'}"
                    ></span>
                    <p class="text-sm">{claimedDevice?.status || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                on:click={() => goto(`/admin/iot/devices/${claimedDevice.id}`)}
                class="w-full sm:w-auto"
              >
                <ExternalLink class="mr-2 h-4 w-4" />
                View Device Details
              </Button>
              
              <Button
                variant="outline"
                on:click={() => goto("/admin/iot/devices")}
                class="w-full sm:w-auto"
              >
                <ArrowLeft class="mr-2 h-4 w-4" />
                Back to Devices
              </Button>
            </div>
          </div>
          </CardContent>
        </Card>
      {/if}
    </PageContent>
  </PageContainer>