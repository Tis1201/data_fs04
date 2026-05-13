<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { toast } from "$lib/stores/alertToast";
  import { AlertTriangle, CheckCircle, ArrowLeft } from "lucide-svelte";
  import { Button, Card, InputField } from "$lib/design-system/components";
  import { deviceStore } from "$lib/stores/device-store";
  import { claimDevice } from "$lib/client/mqtt/claimFlow";
  import { createFormHandler } from "$lib/components/ui_components_sveltekit/form/utils/formHandler";
  import type { PageData } from "./$types";
  
  // Import page data
  export let data: PageData;
  
  // Initialize the form with the reusable form handler
  // Initialize form with validation but without server submission
  const { form, errors, submitting, errorMessage } = createFormHandler(data.pinForm, {
    debugMode: false,
    validateOnInput: true
  });
  
  let claimedDevice: any = null;
  
  // Function to handle device claim via MQTT (replacing SSE request)
  async function handleDeviceClaim() {
    if (!$form.pin || $form.pin.length < 6 || $deviceStore.claimStatus === 'claiming') return;
    
    deviceStore.setClaimStatus('claiming');
    
    try {
      toast.success('Device claim initiated, waiting for confirmation...');

      const confirmation = await claimDevice($form.pin);

      deviceStore.setClaimStatus('claimed');
      toast.success('Device claimed successfully! Redirecting...');
      
      // Wait 5 seconds for device to reconnect with device credentials before redirecting
      await new Promise(resolve => setTimeout(resolve, 5000));
      goto(`/user/iot/devices/${confirmation.deviceId}`);
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

<div class="p-6 space-y-4" style="padding: 24px; gap: 16px;">
  <div class="flex items-center justify-end">
    <Button
      variant="outline"
      color="gray"
      size="lg"
      on:click={() => goto("/user/iot/devices")}
      style="height: 44px;"
    >
      <ArrowLeft size={20} slot="icon" />
      Back to Devices
    </Button>
  </div>

  {#if !claimedDevice}
    <Card
      title="Claim Device"
      subtitle="Connect a new device to your account"
      showHeader={true}
      padding="lg"
      variant="default"
      fullWidth={true}
    >
      <div class="space-y-4">
        {#if $errorMessage || $deviceStore.claimStatus === 'failed'}
          <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm" style="font-family: var(--ds-font-family-primary);">
            <div class="flex items-start gap-3">
              <AlertTriangle size={18} class="mt-0.5 text-red-700" />
              <div class="min-w-0">
                <div class="font-medium text-red-700">Verification failed</div>
                <div class="text-red-700/90">
                  {$deviceStore.error || $errorMessage?.text || "The device could not be claimed. Please try again."}
                </div>
              </div>
            </div>
          </div>
        {:else if $deviceStore.claimStatus === 'claiming'}
          <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm" style="font-family: var(--ds-font-family-primary);">
            <div class="font-medium text-amber-800">Claiming device...</div>
            <div class="text-amber-800/90">Please wait while we verify the PIN code</div>
          </div>
        {/if}

        <div class="max-w-xl">
          <InputField
            id="pin"
            name="pin"
            label="Device PIN Code"
            placeholder="Enter 6-digit PIN"
            bind:value={$form.pin}
            maxlength={6}
            state={$errors.pin ? 'error' : 'default'}
            helperText={$errors.pin || "Enter the 6-digit PIN displayed on your device"}
            disabled={$submitting || $deviceStore.claimStatus === 'claiming'}
          />
        </div>

        <div class="flex items-center justify-end">
          <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={handleDeviceClaim}
            disabled={!$form.pin || $form.pin.length < 6 || $deviceStore.claimStatus === 'claiming'}
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
          >
            Claim Device
          </Button>
        </div>
      </div>
    </Card>
  {:else}
    <Card
      title="Device Claimed Successfully"
      subtitle="Your device has been claimed and is ready to use."
      showHeader={true}
      padding="lg"
      variant="default"
      fullWidth={true}
    >
      <div class="space-y-4">
        <div class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm" style="font-family: var(--ds-font-family-primary);">
          <div class="flex items-start gap-3">
            <CheckCircle size={18} class="mt-0.5 text-green-700" />
            <div class="min-w-0">
              <div class="font-medium text-green-700">Device claimed</div>
              <div class="text-green-700/90">Redirecting to device details…</div>
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <Button
            variant="filled"
            color="primary"
            size="lg"
            on:click={() => goto(`/user/iot/devices/${claimedDevice.id}`)}
            style="height: 44px; background: #0086C9; border: 1px solid #0086C9; box-shadow: 0px 1px 2px rgba(16, 24, 40, 0.05);"
          >
            View Device
          </Button>
          <Button
            variant="outline"
            color="gray"
            size="lg"
            on:click={() => goto("/user/iot/devices")}
            style="height: 44px;"
          >
            Back to Device List
          </Button>
        </div>
      </div>
    </Card>
  {/if}
</div>
