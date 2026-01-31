<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Pencil, Download, Info } from 'lucide-svelte';
    import { Button, Card } from '$lib/design-system/components';
    import AddEditResourceModal from '../components/AddEditResourceModal.svelte';
    import type { PageData } from './$types';
    import { toast } from '$lib/stores/alertToast';

    export let data: PageData;
    export let params: Record<string, string> = {};

    const { resource, accounts = [] } = data;

    let showEditModal = false;

    function formatDateTime(d: Date | string | null | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function typeDisplay(type: string): string {
        const m: Record<string, string> = {
            application: 'Application',
            file: 'File',
            image: 'Image',
            video: 'Video',
            document: 'Document',
            archive: 'Archive',
            package: 'Package'
        };
        return m[type?.toLowerCase()] ?? type ?? '—';
    }

    function targetDisplay(target: string | null | undefined): string {
        if (!target) return '—';
        const t = target.toLowerCase();
        if (t === 'user') return 'User';
        if (t === 'device') return 'Device';
        if (t === 'account') return 'Account';
        return target;
    }

    $: createdByLabel = resource.creator
        ? `${resource.creator.name || resource.creator.email || 'Unknown'}`
        : 'Unknown';
    $: updatedByLabel = resource.updater
        ? `${resource.updater.name || resource.updater.email || 'Unknown'}`
        : 'Unknown';
    $: uploadedFileName = resource.path
        ? resource.path.split('/').filter(Boolean).pop() || resource.name || '—'
        : resource.name || '—';

</script>

<div class="resource-detail flex flex-col items-start w-full" style="padding: var(--ds-space-6); gap: var(--ds-space-6);">
    <div class="flex flex-row justify-end w-full" style="gap: var(--ds-space-2);">
        <Button
            variant="filled"
            color="primary"
            size="lg"
            iconLeft={true}
            on:click={() => (showEditModal = true)}
        >
            <Pencil size={20} slot="icon-left" />
            Edit Set
        </Button>
    </div>

    <!-- Resource Overview card: header (icon + title + subtitle), 2-col grid, Resource Path, footer -->
    <Card
        variant="default"
        padding="none"
        radius="2xl"
        showHeader={true}
        fullWidth={true}
    >
        <div
            slot="header"
            class="resource-overview-header"
        >
            <div class="resource-overview-header-icon">
                <Info size={20} />
            </div>
            <div class="resource-overview-header-text">
                <h3 class="resource-overview-title">Resource Overview</h3>
                <p class="resource-overview-subtitle">Key information about this resource</p>
            </div>
        </div>
        <div class="resource-overview-body">
            <div class="resource-overview-grid">
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Resource Name</span>
                    <span class="resource-overview-value">{resource.name || '—'}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Package Name</span>
                    <span class="resource-overview-value">{resource.packageName || '—'}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Target</span>
                    <span class="resource-overview-value">{targetDisplay(resource.target)}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Version</span>
                    <span class="resource-overview-value">{resource.version || '—'}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Type</span>
                    <span class="resource-overview-value">{typeDisplay(resource.type)}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Account</span>
                    <span class="resource-overview-value">{resource.account?.name ?? '—'}</span>
                </div>
                <div class="resource-overview-field resource-overview-field-span-2">
                    <span class="resource-overview-label">Resource Uploaded File</span>
                    {#if resource.path}
                        <a
                            href="/api/resources/{resource.id}"
                            download={uploadedFileName}
                            class="resource-overview-file-link"
                        >
                            <Download size={16} />
                            {uploadedFileName}
                        </a>
                    {:else}
                        <span class="resource-overview-value">—</span>
                    {/if}
                </div>
                <div class="resource-overview-path-section">
                    <span class="resource-overview-label">Resource Path</span>
                    <span class="resource-overview-path-value">{resource.path || '—'}</span>
                </div>
            </div>
            <div class="resource-overview-footer">
                <p class="resource-overview-footer-line">
                    Created by {createdByLabel} at {formatDateTime(resource.createdAt)}
                </p>
                <p class="resource-overview-footer-line">
                    Last updated by {updatedByLabel} at {formatDateTime(resource.updatedAt)}
                </p>
            </div>
        </div>
    </Card>

    <AddEditResourceModal
        open={showEditModal}
        mode="edit"
        resourceId={resource.id}
        initialData={{
            name: resource.name,
            packageName: resource.packageName ?? undefined,
            target: resource.target ?? undefined,
            version: resource.version ?? undefined,
            accountId: resource.accountId ?? undefined,
            path: resource.path ?? undefined,
            type: resource.type,
            format: resource.format ?? undefined,
            size: resource.size
        }}
        accounts={accounts}
        on:close={() => (showEditModal = false)}
        on:success={() => {
            showEditModal = false;
            toast.success('Resource updated successfully.');
            goto($page.url.pathname, { invalidateAll: true });
        }}
        on:error={(e) => toast.error(e.detail || 'Unable to update resource. Please try again!')}
    />
</div>

<style>
    /* Figma: header — padding 16px, gap 8px, border-bottom #E5E5E5 */
    .resource-overview-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 8px;
        border-bottom: 1px solid #E5E5E5;
        font-family: var(--ds-font-family-primary);
    }
    /* 44×44px, border-radius 8px; default gray icon only, hover show gray background */
    .resource-overview-header-icon {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        border-radius: 8px;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #525252;
        transition: background-color 0.15s ease;
    }
    .resource-overview-header-icon:hover {
        background: var(--ds-color-neutral-true-100);
    }
    .resource-overview-header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
    }
    /* Figma: Body/18px/18-Medium, #141414 */
    .resource-overview-title {
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }
    /* Figma: Body/14px/14-Regular, Gray/600 #475467 */
    .resource-overview-subtitle {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }
    /* Figma: details wrap — padding 16px, gap 16px */
    .resource-overview-body {
        padding: 16px;
        font-family: var(--ds-font-family-primary);
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    /* Figma: wrap row — gap 16px; 4 cols equal */
    .resource-overview-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
    }
    .resource-overview-field-span-2 {
        grid-column: span 2;
    }
    .resource-overview-path-section {
        grid-column: 1 / -1;
    }
    /* Figma: Text Display — flex column, gap 4px (label–value) */
    .resource-overview-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }
    /* Figma: Label — 14px Regular, #525252 */
    .resource-overview-label {
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
    }
    /* Figma: Value — 16px Medium, #141414 */
    .resource-overview-value {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
    }
    /* Figma: Resource Uploaded File — use design system token primary-600 (#155EEF) */
    .resource-overview-file-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: var(--ds-color-primary-600);
        text-decoration: none;
    }
    .resource-overview-file-link:hover {
        text-decoration: underline;
    }
    /* Resource Path — full-width grid row, same gap as other fields, no divider */
    .resource-overview-path-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }
    .resource-overview-path-value {
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
        word-break: break-all;
        font-family: ui-monospace, monospace;
    }
    /* Figma: footer — divider, gap 4px */
    .resource-overview-footer {
        padding-top: 16px;
        border-top: 1px solid #E5E5E5;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    /* Figma: Body/12px/12-Regular, #525252, letter-spacing 0.01em */
    .resource-overview-footer-line {
        font-weight: 400;
        font-size: 12px;
        line-height: 16px;
        letter-spacing: 0.01em;
        color: #525252;
        margin: 0;
    }
</style>
