<script lang="ts">
    import { UsersRound } from 'lucide-svelte';

    /** compact = tighter padding for inline headers; default = table-friendly */
    export let variant: 'default' | 'compact' = 'default';
</script>

<span
    class="resource-shared-badge"
    class:resource-shared-badge--compact={variant === 'compact'}
    role="status"
    title="This resource belongs to another account and was shared with yours. You have view-only access."
>
    <UsersRound size={variant === 'compact' ? 14 : 15} strokeWidth={2} aria-hidden="true" />
    <span class="resource-shared-badge__text">Shared with you</span>
</span>

<style>
    .resource-shared-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        max-width: 100%;
        border-radius: 9999px;
        border: 1px solid #c7d7fe;
        background: #eef4ff;
        color: #3538cd;
        font-family: var(--ds-font-family-primary, inherit);
        font-weight: 600;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        padding: 4px 10px;
    }

    .resource-shared-badge--compact {
        padding: 3px 8px;
        font-size: 11px;
        line-height: 14px;
        gap: 5px;
    }

    .resource-shared-badge :global(svg) {
        flex-shrink: 0;
        color: #444ce7;
    }

    .resource-shared-badge__text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
