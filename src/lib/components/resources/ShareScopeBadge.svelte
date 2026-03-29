<script lang="ts">
    import { Badge } from '$lib/components/ui/badge';

    /** Prisma ResourceShareScope or missing (treat as NONE) */
    export let shareScope: string | undefined;
    export let selectedCount: number = 0;
</script>

{#if shareScope === 'ALL_ACCOUNTS'}
    <Badge variant="default">Shared (all)</Badge>
{:else if shareScope === 'SELECTED_ACCOUNTS'}
    <Badge variant="outline">Shared ({selectedCount})</Badge>
{:else}
    <Badge variant="secondary">Private</Badge>
{/if}
