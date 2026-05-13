<script lang="ts">
    import { Alert } from '$lib/design-system/components';
    import { alertToastStore } from '$lib/stores/alertToast';
</script>

{#if $alertToastStore.length > 0}
    <div class="alert-toast-container" role="region" aria-label="Notifications">
        {#each $alertToastStore as item (item.id)}
            <Alert
                severity={item.severity}
                variant="filled"
                message={item.message}
                title={item.title ?? ''}
                dismissible={true}
                on:dismiss={() => alertToastStore.remove(item.id)}
            />
        {/each}
    </div>
{/if}

<style>
    .alert-toast-container {
        position: fixed;
        bottom: var(--ds-space-6, 24px);
        right: var(--ds-space-6, 24px);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3, 12px);
        max-width: 400px;
        min-width: 280px;
    }
</style>
