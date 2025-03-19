<script lang="ts">
  import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
  } from "$lib/components/ui/alert-dialog/index.js";

  export let open: boolean; // Controls dialog visibility
  export let title: string; // Title of the dialog
  export let description: string; // Description of the dialog
  export let confirmText: string = "Confirm"; // Text for the confirm button
  export let cancelText: string = "Cancel"; // Text for the cancel button
  export let onConfirm: () => void; // Callback for confirm action
  export let onCancel: (() => void) | null = null; // Optional callback for cancel action

  // Handle the confirm action
  function handleConfirm() {
    if (onConfirm) {
      onConfirm();
    }
    open = false; // Close the dialog after confirmation
  }

  // Handle the cancel action
  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
    open = false; // Always close the dialog on cancel
  }
</script>

<AlertDialog bind:open>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{title}</AlertDialogTitle>
      <AlertDialogDescription>{description}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel on:click={handleCancel}>{cancelText}</AlertDialogCancel>
      <AlertDialogAction on:click={handleConfirm}>{confirmText}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>

<style>
  /* Add any custom styles if needed */
</style>
