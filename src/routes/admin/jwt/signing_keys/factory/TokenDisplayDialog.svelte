<script lang="ts">
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import CopyableText from "$lib/components/ui_components_sveltekit/display/CopyableText.svelte";

  export let open: boolean;
  export let token: string = "";
  export let onClose: () => void = () => {};
</script>

<Dialog bind:open on:close={onClose}>
  <DialogContent class="sm:max-w-2xl max-w-[90vw] max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Factory Token</DialogTitle>
      <DialogDescription>
        Use this short-lived token for device factory authentication. Keep it secure.
      </DialogDescription>
    </DialogHeader>

    <div class="mt-2">
      <CopyableText
        text={token}
        label="JWT"
        mask={true}
        visiblePrefix={12}
        visibleSuffix={12}
        maskLength={16}
        className="w-full"
      />
    </div>

    <DialogFooter class="sm:justify-end mt-4">
      <Button on:click={onClose}>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
