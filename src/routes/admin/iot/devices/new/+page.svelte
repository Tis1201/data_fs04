<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { AlertTriangle, CheckCircle, ArrowLeft, ExternalLink } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
  import { deviceStore } from "$lib/stores/device-store";
  import { sseStore } from "$lib/stores/sse-store";
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
  import type { PageData } from "./$types";

  // Import page data
  export let data: PageData;

  // Page title and breadcrumbs
  const pageTitle = "Claim Device";
  const pageDescription = "Connect a new device to your account";
  const pageCrumbs = [
    ["Dashboard", "/user/dashboard"],
    ["IoT", "/user/iot"],
    ["Devices", "/user/iot/devices"],
    ["Claim Device", ""]
  ] as [string, string][];

  // Initialize the form with the reusable form handler
  // Initialize form with validation but without server submission
  const { form, errors, submitting, errorMessage } = createFormHandler(data.pinForm, {
    debugMode: false,
    validateOnInput: true
  });

  let claimedDevice: any = null;

  // Function to handle device claim via SSE
  async function handleDeviceClaim() {
    if (!$form.pin || $form.pin.length < 6 || $deviceStore.claimStatus === 'claiming') return;

    // Use SSE request to claim device instead of form submission
    deviceStore.setClaimStatus('claiming');

    try {
      const responsePayload = await sseStore.sendRequest(
              {
                type: 'device',
                scope: 'user:self',
                payload: {
                  action: 'claim',
                  pin: $form.pin
                }
              },
              5000, // 5 second timeout
              'device_claim'
      );

      console.log('[DEVICE_FORM] Claim request sent successfully:', responsePayload);

      // Check for error in the response payload
      if (responsePayload?.success === false || responsePayload?.payload?.success === false) {
        // Handle error case from SSE response
        const errorDetails = responsePayload?.payload || responsePayload;
        deviceStore.setClaimStatus('failed', errorDetails.details || errorDetails.error || 'Verification failed');
        toast.error(errorDetails.error || 'Verification Failed');
        return;
      }

      // If we have device data in the response, update the UI
      const device = responsePayload?.device || responsePayload?.payload?.device;
      if (device) {
        claimedDevice = {
          id: device.id,
          name: device.name,
          deviceType: device.deviceType,
          status: device.status || 'ACTIVE'
        };

        deviceStore.updateDevice({
          deviceId: device.id,
          name: device.name,
          deviceType: device.deviceType,
          status: device.status,
          claimStatus: 'claimed'
        });

        toast.success('Device claimed successfully!');
      } else {
        // No device data in response, but success
        deviceStore.setClaimStatus('claimed');
        toast.success('Device claimed successfully!');
      }
    } catch (error) {
      console.error('[DEVICE_FORM] Claim request failed:', error);
      deviceStore.setClaimStatus('failed', error instanceof Error ? error.message : 'Request failed');
      toast.error('Failed to claim device. Please try again.');
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

<UserPageLayout
        title={pageTitle}
        description={pageDescription}
        crumbs={pageCrumbs}
        actionButtons={[
    {
      label: "Back to Devices",
      icon: ArrowLeft,
      onClick: () => goto("/admin/iot/devices"),
      // variant: "outline"
    }
  ]}
>
  {#if !claimedDevice}
    <!-- Step 1: Enter PIN Code -->
    <Card class="w-full">
      <CardContent class="pt-6">
        <div class="flex flex-col items-center justify-center space-y-4 p-4">
          <!-- Status display -->
          {#if $errorMessage}
            <!-- Form handler error message takes precedence -->
            <div class="mb-4 p-4 rounded-md w-full flex items-center gap-3 bg-destructive/10 border border-destructive/20 text-destructive">
              <div class="h-10 w-10 flex-shrink-0 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle class="h-5 w-5" />
              </div>
              <div class="w-full">
                <p class="text-sm">{$errorMessage.text}</p>
                {#if $errorMessage.details}
                  <p class="text-xs mt-1">{$errorMessage.details}</p>
                {/if}
              </div>
            </div>
          {:else if $deviceStore.claimStatus === 'failed'}
            <!-- Error state from device store -->
            <div class="mb-4 p-4 rounded-md w-full flex items-center gap-3 bg-destructive/10 border border-destructive/20 text-destructive">
              <div class="h-10 w-10 flex-shrink-0 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle class="h-5 w-5" />
              </div>
              <div class="w-full">
                <p class="font-medium">Verification Failed</p>
                <p class="text-sm">{$deviceStore.error || "The device could not be claimed. Please try again."}</p>
              </div>
            </div>
          {:else if $deviceStore.claimStatus === 'claiming'}
            <!-- Loading state with Skeleton component for better UX -->
            <div class="mb-4 p-4 rounded-md w-full flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800">
              <div class="h-10 w-10 flex-shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
                <div class="h-5 w-5 animate-pulse">
                  <Skeleton class="h-5 w-5 rounded-full" />
                </div>
              </div>
              <div class="w-full">
                <div class="flex items-center justify-between">
                  <p class="font-medium">Claiming device...</p>
                  <div class="flex space-x-1">
                    <span class="h-2 w-2 rounded-full bg-amber-300 animate-pulse"></span>
                    <span class="h-2 w-2 rounded-full bg-amber-300 animate-pulse delay-150"></span>
                    <span class="h-2 w-2 rounded-full bg-amber-300 animate-pulse delay-300"></span>
                  </div>
                </div>
                <p class="text-sm">Please wait while we verify the PIN code</p>
              </div>
            </div>
          {/if}

          <!-- PIN input form using Superforms -->
          <div class="w-full max-w-md">
            <form class="space-y-6">
              <div class="space-y-2">
                <Label for="pin" class="text-base">Device PIN Code <span class="text-destructive">*</span></Label>
                <div class="flex justify-center">
                  <Input
                          id="pin"
                          type="text"
                          name="pin"
                          placeholder="Enter 6-digit PIN"
                          bind:value={$form.pin}
                          class="text-center text-lg tracking-widest font-mono"
                          maxlength="6"
                          disabled={$submitting || $deviceStore.claimStatus === 'claiming'}
                          autocomplete="off"
                          aria-invalid={$errors.pin ? 'true' : undefined}
                  />
                </div>
                {#if $errors.pin}
                  <p class="text-xs text-destructive text-center mt-1">{$errors.pin}</p>
                {:else}
                  <p class="text-xs text-muted-foreground text-center mt-1">
                    Enter the 6-digit PIN displayed on your device
                  </p>
                {/if}
              </div>

              <div class="flex justify-center pt-4">
                <div class="w-full space-y-2">
                  <Button
                          type="button"
                          on:click={handleDeviceClaim}
                          class="w-full relative h-11"
                          size="lg"
                          disabled={!$form.pin || $form.pin.length < 6 || $deviceStore.claimStatus === 'claiming'}
                  >
                    {#if $deviceStore.claimStatus === 'claiming'}
                      <span class="absolute inset-0 flex items-center justify-center gap-1.5">
                        <Skeleton class="h-5 w-5 rounded-full animate-pulse" />
                        <Skeleton class="h-5 w-20" />
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
    <Card class="w-full">
      <CardHeader class="pb-4 border-b">
        <CardTitle>Device Claimed Successfully</CardTitle>
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
</UserPageLayout>
