<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Pencil, Download, Info, Copy } from 'lucide-svelte';
    import { Button, Card, Tooltip } from '$lib/design-system/components';
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

    function releaseTypeDisplay(rt: string | null | undefined): string {
        if (!rt) return 'Production';
        const t = rt.trim();
        if (['Alpha', 'Beta', 'Production'].includes(t)) return t;
        return rt;
    }

    function formatBytes(bytes: number | null | undefined): string {
        if (bytes == null || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    const TRUNCATE_FILE_NAME = 56;
    const TRUNCATE_PATH = 80;

    function truncateWithEllipsis(str: string | null | undefined, maxLen: number): string {
        if (!str) return '—';
        if (str.length <= maxLen) return str;
        return str.slice(0, maxLen - 3) + '...';
    }

    /** Display filename from path: strip query string, take last segment, truncate if long */
    function displayFileName(path: string | null | undefined): string {
        if (!path) return '—';
        const withoutQuery = path.split('?')[0];
        const segment = withoutQuery.split('/').filter(Boolean).pop() || path;
        return truncateWithEllipsis(segment, TRUNCATE_FILE_NAME);
    }

    $: createdByLabel = resource.creator
        ? `${resource.creator.name || resource.creator.email || 'Unknown'}`
        : 'Unknown';
    $: updatedByLabel = resource.updater
        ? `${resource.updater.name || resource.updater.email || 'Unknown'}`
        : 'Unknown';
    /** Filename for download attribute (no query string) */
    $: downloadFileName = resource.path
        ? (resource.path.split('?')[0].split('/').filter(Boolean).pop() || resource.name || 'resource')
        : resource.name || 'resource';
        
    /** Truncated display values for the card */
    $: nameDisplay = truncateWithEllipsis(resource.name, 40);
    $: packageNameDisplay = truncateWithEllipsis(resource.packageName, 40);
    $: versionDisplay = truncateWithEllipsis(resource.version, 24);
    $: signatureDisplay = truncateWithEllipsis(resource.signature, 64);
    
    /** Short display for "Resource Uploaded File" (truncated if long) */
    $: uploadedFileDisplay = displayFileName(resource.path) || resource.name || '—';
    /** Short display for "Resource Path" (truncated if long) */
    $: pathDisplay = truncateWithEllipsis(resource.path, TRUNCATE_PATH);

    async function copyResourcePath() {
        if (!resource.path) return;
        try {
            await navigator.clipboard.writeText(resource.path);
            toast.success('Resource path copied to clipboard');
        } catch {
            toast.error('Failed to copy path');
        }
    }

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
                    <Tooltip text={resource.name || ''} position="top" portal={true} maxWidth={500}>
                        <span class="resource-overview-value resource-overview-truncate">{nameDisplay}</span>
                    </Tooltip>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Package Name</span>
                    <Tooltip text={resource.packageName || ''} position="top" portal={true} maxWidth={500}>
                        <span class="resource-overview-value resource-overview-truncate">{packageNameDisplay}</span>
                    </Tooltip>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Version</span>
                    <Tooltip text={resource.version || ''} position="top" portal={true} maxWidth={500}>
                        <span class="resource-overview-value resource-overview-truncate">{versionDisplay}</span>
                    </Tooltip>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Type</span>
                    <span class="resource-overview-value">{typeDisplay(resource.type)}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Release Type</span>
                    <span class="resource-overview-value">{releaseTypeDisplay(resource.releaseType)}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Format</span>
                    <span class="resource-overview-value">{(resource.format || '—').toUpperCase()}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Size</span>
                    <span class="resource-overview-value">{formatBytes(resource.size)}</span>
                </div>
                <div class="resource-overview-field">
                    <span class="resource-overview-label">Account</span>
                    <span class="resource-overview-value">{resource.account?.name ?? '—'}</span>
                </div>
                {#if resource.versionCode != null}
                    <div class="resource-overview-field">
                        <span class="resource-overview-label">Version Code</span>
                        <span class="resource-overview-value">{resource.versionCode}</span>
                    </div>
                {/if}
                {#if resource.signature}
                    <div class="resource-overview-field resource-overview-field-span-2">
                        <span class="resource-overview-label">Signature</span>
                        <Tooltip text={resource.signature || ''} position="top" portal={true} maxWidth={500}>
                            <span class="resource-overview-value resource-overview-value-mono resource-overview-truncate">
                                {signatureDisplay}
                            </span>
                        </Tooltip>
                    </div>
                {/if}
                {#if resource.description}
                    <div class="resource-overview-field resource-overview-field-span-2">
                        <span class="resource-overview-label">Description</span>
                        <span class="resource-overview-value">{resource.description}</span>
                    </div>
                {/if}
                <div class="resource-overview-field resource-overview-field-span-2">
                    <span class="resource-overview-label">Resource Uploaded File</span>
                    {#if resource.path}
                        <a
                            href="/api/resources/{resource.id}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="resource-overview-file-link"
                            title="Download (generates signed URL, same as admin)"
                            on:click|preventDefault={() => window.open(`/api/resources/${resource.id}`, '_blank')}
                        >
                            <Download size={16} />
                                <Tooltip text={resource.path || ''} position="top" portal={true} maxWidth={500}>
                                    <span class="resource-overview-truncate">{uploadedFileDisplay}</span>
                                </Tooltip>
                        </a>
                    {:else}
                        <span class="resource-overview-value">—</span>
                    {/if}
                </div>
                <div class="resource-overview-path-section">
                    <span class="resource-overview-label">Resource Path</span>
                    <div class="resource-overview-path-row">
                        {#if resource.path}
                            <button
                                type="button"
                                class="resource-overview-path-copy"
                                title="Copy full path"
                                on:click={copyResourcePath}
                            >
                                <Copy size={16} />
                            </button>
                        {/if}
                        <Tooltip text={resource.path || ''} position="top" portal={true} maxWidth={600}>
                            <span
                                class="resource-overview-path-value resource-overview-truncate"
                            >{pathDisplay}</span>
                        </Tooltip>
                    </div>
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
            size: resource.size,
            releaseType: resource.releaseType ?? undefined,
            versionCode: resource.versionCode ?? undefined,
            signature: resource.signature ?? undefined
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
    .resource-overview-value-mono {
        font-family: ui-monospace, monospace;
        font-size: 14px;
        word-break: break-all;
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
    .resource-overview-path-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }
    .resource-overview-path-row .resource-overview-path-value {
        flex: 1;
        min-width: 0;
    }
    .resource-overview-path-copy {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #525252;
        cursor: pointer;
    }
    .resource-overview-path-copy:hover {
        background: var(--ds-color-neutral-true-100);
        color: #141414;
    }
    .resource-overview-field :global(.tooltip-wrapper) {
        width: 100%;
        display: flex;
    }
    .resource-overview-truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
        display: inline-block;
        vertical-align: bottom;
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
