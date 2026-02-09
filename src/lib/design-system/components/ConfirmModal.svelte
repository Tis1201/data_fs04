<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from './Modal.svelte';
  import type { ModalType } from './Modal.svelte';

  export let open: boolean = false;
  export let title: string = '';
  export let description: string = '';
  export let confirmText: string = 'Confirm';
  export let cancelText: string = 'Cancel';
  export let confirmLoading: boolean = false;
  export let confirmDisabled: boolean = false;
  /** Icon style: 'error' | 'warning' for destructive/caution, 'info' for informational (e.g. Reactivate). */
  export let type: ModalType = 'error';

  const dispatch = createEventDispatcher<{ close: void; confirm: void }>();
</script>

<Modal
  {open}
  {title}
  {type}
  size="md"
  {cancelText}
  {confirmText}
  {confirmLoading}
  {confirmDisabled}
  on:close={() => dispatch('close')}
  on:confirm={() => dispatch('confirm')}
>
  <p class="text-[var(--ds-text-secondary)]">
    {description}
  </p>
</Modal>
