<script lang="ts">
    import { invalidate } from '$app/navigation';
    import AdminCard from '$lib/components/admin/layout/AdminCard.svelte';
    import { Button } from '$lib/components/ui/button';
    import { Badge } from '$lib/components/ui/badge';
    import { Share2 } from 'lucide-svelte';
    import { toast } from 'svelte-sonner';

    export let resourceId: string;
    /** Current resource row (admin detail); used to sync after load / invalidate */
    export let resource: {
        shareScope?: string;
        sharedWithAccountIds?: string[];
        updatedAt?: string | Date;
    };
    export let accountOptions: { value: string; label: string }[] = [];

    const SCOPE_NONE = 'NONE';
    const SCOPE_ALL = 'ALL_ACCOUNTS';
    const SCOPE_SELECTED = 'SELECTED_ACCOUNTS';

    let scope: string = SCOPE_NONE;
    let selectedAccountIds: string[] = [];
    let saving = false;

    let lastSyncKey = '';
    $: syncKey = `${resourceId}-${resource.updatedAt}-${resource.shareScope}-${(resource.sharedWithAccountIds ?? []).join(',')}`;
    $: if (resourceId && syncKey !== lastSyncKey) {
        lastSyncKey = syncKey;
        const s = resource.shareScope;
        scope = s === SCOPE_ALL || s === SCOPE_SELECTED ? s : SCOPE_NONE;
        selectedAccountIds = [...(resource.sharedWithAccountIds ?? [])];
    }

    async function saveShare() {
        if (scope === SCOPE_SELECTED && selectedAccountIds.length === 0) {
            toast.error('Select at least one account, or choose Private or All accounts');
            return;
        }
        saving = true;
        try {
            const res = await fetch(`/api/v2/resources/${resourceId}/share`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shareScope: scope,
                    accountIds: scope === SCOPE_SELECTED ? selectedAccountIds : undefined
                })
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = json?.error?.message || json?.message || res.statusText;
                toast.error(msg || 'Failed to update sharing');
                return;
            }
            await invalidate('app:resources');
            toast.success('Sharing settings saved');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update sharing');
        } finally {
            saving = false;
        }
    }
</script>

<AdminCard
    title="Sharing"
    description="Control which accounts can see and install this resource (view + install only; no edit or download for recipients)."
    icon={Share2}
    compact={true}
>
    <div class="space-y-4">
        <div class="flex flex-col gap-3">
            <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" bind:group={scope} value={SCOPE_NONE} name="shareScope" />
                <span>Private</span>
                <Badge variant="secondary">Owner account only</Badge>
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" bind:group={scope} value={SCOPE_ALL} name="shareScope" />
                <span>All accounts</span>
                <Badge variant="default">Shared (all)</Badge>
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input type="radio" bind:group={scope} value={SCOPE_SELECTED} name="shareScope" />
                <span>Selected accounts</span>
                <Badge variant="outline">Shared (N)</Badge>
            </label>
        </div>

        {#if scope === SCOPE_SELECTED}
            <div class="rounded-md border border-border p-3">
                <p class="mb-2 text-xs text-muted-foreground">
                    Choose accounts that may use this resource. Changes replace the previous list.
                </p>
                <div class="max-h-48 space-y-2 overflow-y-auto">
                    {#each accountOptions as opt (opt.value)}
                        <label class="flex cursor-pointer items-center gap-2 text-sm">
                            <input type="checkbox" value={opt.value} bind:group={selectedAccountIds} />
                            <span>{opt.label}</span>
                        </label>
                    {/each}
                </div>
            </div>
        {/if}

        <Button type="button" disabled={saving} on:click={saveShare}>
            {saving ? 'Saving…' : 'Save sharing'}
        </Button>
    </div>
</AdminCard>
