<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Pencil, Info, Monitor, Download } from 'lucide-svelte';
    import { Button, Card, InputField } from '$lib/design-system/components';
    import AddEditPreclaimModal from '../components/AddEditPreclaimModal.svelte';
    import PreclaimDeviceTable from '$lib/components/ui_components_sveltekit/preclaims/PreclaimDeviceTable.svelte';
    import type { PageData } from './$types';
    import { toast } from '$lib/stores/alertToast';

    export let data: PageData;

    const { preclaimSet, claims = [], metrics = {}, profileOptions = [] } = data;

    let showEditModal = false;
    let searchDisplayValue = '';
    let searchDebounceId: ReturnType<typeof setTimeout> | null = null;
    let skipSearchSync = false;
    let importCsvInput: HTMLInputElement | undefined;
    let importCsvSubmitting = false;

    async function onImportCsvFile(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || !preclaimSet?.id) return;
        importCsvSubmitting = true;
        try {
            const formData = new FormData();
            formData.set('file', file);
            const res = await fetch($page.url.pathname + '?/importDevices', { method: 'POST', body: formData });
            let data: { success?: boolean; data?: { imported?: number; message?: string } | string; type?: string; error?: { message?: string } };
            try {
                data = await res.json();
            } catch {
                data = {};
            }
            let importedCount: number | undefined;
            if (data?.success && data?.data != null && typeof data.data === 'object' && typeof (data.data as { imported?: number }).imported === 'number') {
                importedCount = (data.data as { imported: number }).imported;
            } else if (data?.type === 'success' && data?.data != null) {
                const d = data.data;
                if (typeof d === 'object' && d && 'imported' in d && typeof (d as { imported: unknown }).imported === 'number') {
                    importedCount = (d as { imported: number }).imported;
                } else if (typeof d === 'string') {
                    try {
                        const parsed = JSON.parse(d) as unknown;
                        if (Array.isArray(parsed)) {
                            const last = parsed[parsed.length - 1];
                            importedCount = typeof last === 'number' ? last : (parsed[2] && typeof parsed[2] === 'object' && 'imported' in parsed[2] ? (parsed[2] as { imported: number }).imported : undefined);
                        } else if (parsed && typeof parsed === 'object' && 'imported' in parsed) {
                            importedCount = (parsed as { imported: number }).imported;
                        }
                    } catch {
                        // ignore
                    }
                }
            }
            if (importedCount != null && typeof importedCount === 'number') {
                toast.success(importedCount === 1 ? '1 device imported successfully!' : `${importedCount} devices imported successfully!`);
                goto($page.url.pathname, { invalidateAll: true });
            } else {
                let msg: string | undefined;
                if (data?.type === 'failure') {
                    const d = data.data;
                    if (typeof d === 'object' && d && 'message' in d && typeof (d as { message: unknown }).message === 'string') {
                        msg = (d as { message: string }).message;
                    } else if (typeof d === 'string') {
                        try {
                            const parsed = JSON.parse(d) as unknown;
                            if (Array.isArray(parsed) && parsed.length >= 2 && typeof parsed[1] === 'string') {
                                msg = parsed[1];
                            } else if (parsed && typeof parsed === 'object' && 'message' in parsed && typeof (parsed as { message: unknown }).message === 'string') {
                                msg = (parsed as { message: string }).message;
                            } else {
                                msg = d;
                            }
                        } catch {
                            msg = d;
                        }
                    }
                } else {
                    msg = data?.error?.message;
                }
                toast.error(msg ?? (res.ok ? 'Import failed.' : 'Unable to import devices. Please try again.'));
            }
        } catch (_) {
            toast.error('Unable to import devices. Please try again.');
        } finally {
            importCsvSubmitting = false;
        }
    }

    function formatDate(d: Date | string | null | undefined): string {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    }

    function statusDisplay(status: string | null | undefined): string {
        const s = (status || '').toUpperCase();
        if (s === 'ACTIVE') return 'Active';
        if (s === 'INACTIVE') return 'Inactive';
        return status || '—';
    }

    function onSearchInput(e: CustomEvent<string>) {
        const v = e.detail ?? '';
        searchDisplayValue = v;
        if (searchDebounceId) clearTimeout(searchDebounceId);
        searchDebounceId = setTimeout(() => {
            skipSearchSync = true;
            const url = new URL($page.url.href);
            if (v) url.searchParams.set('search', v); else url.searchParams.delete('search');
            url.searchParams.set('page', '1');
            goto(url.toString(), { replaceState: true, noScroll: true });
            skipSearchSync = false;
            searchDebounceId = null;
        }, 400);
    }

    $: urlSearch = $page.url.searchParams.get('search') || '';
    $: if (!skipSearchSync && urlSearch !== searchDisplayValue) searchDisplayValue = urlSearch;

    $: metricsData = (data.metrics || {}) as { total?: number; claimed?: number; left?: number };
    $: totalDevices = metricsData.total ?? claims?.length ?? 0;
    $: devicesRegistered = metricsData.claimed ?? 0;
    $: devicesPending = metricsData.left ?? Math.max(0, totalDevices - devicesRegistered);
    $: profileLink = preclaimSet?.profile?.id
        ? `/user/iot/device-profiles/${preclaimSet.profile.id}`
        : null;
    $: profileOptionsList = (profileOptions || []).map((p: { id: string; label: string }) => ({ id: p.id, label: p.label }));
    $: accountOptionsList = (data.accountOptions || []).map((a: { id: string; label: string }) => ({ id: a.id, label: a.label }));
</script>

<div class="preclaim-detail">
    <!-- Buttons row: align end (Figma: buttons wrap) -->
    <div class="detail-buttons">
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

    <!-- Frame 50: overview card + summary cards -->
    <div class="detail-grid">
        <Card variant="default" padding="none" radius="2xl" showHeader={true} fullWidth={true}>
            <div slot="header" class="overview-header">
                <div class="overview-header-left">
                    <div class="overview-header-icon">
                        <Info size={20} />
                    </div>
                    <div class="overview-header-text">
                        <h3 class="overview-title">Pre-Enrollment Overview</h3>
                        <p class="overview-subtitle">
                            Pre-register devices to automatically assign them to the correct account and device profile during enrollment.
                        </p>
                    </div>
                </div>
            </div>
            <div class="overview-body">
                <!-- Grid: row1 = Name, Status, Assigned Account, Device Profile | row2 = Valid Until, Description -->
                <div class="overview-grid">
                    <div class="overview-field">
                        <span class="overview-label">Name</span>
                        <span class="overview-value">{preclaimSet?.name || '—'}</span>
                    </div>
                    <div class="overview-field">
                        <span class="overview-label">Set status</span>
                        <span
                            class="status-badge status-badge-{(preclaimSet?.status || '').toLowerCase() === 'active' ? 'success' : 'gray'}"
                            aria-label="Set status: {statusDisplay(preclaimSet?.status)}"
                        >
                            <span class="status-badge-dot"></span>
                            <span class="status-badge-label">{statusDisplay(preclaimSet?.status)}</span>
                        </span>
                    </div>
                    <div class="overview-field">
                        <span class="overview-label">Assigned Account</span>
                        <span class="overview-value">{preclaimSet?.account?.name ?? '—'}</span>
                    </div>
                    <div class="overview-field">
                        <span class="overview-label">Device Profile</span>
                        {#if profileLink && preclaimSet?.profile?.name}
                            <a href={profileLink} class="overview-link">{preclaimSet.profile.name}</a>
                        {:else}
                            <span class="overview-value">—</span>
                        {/if}
                    </div>
                    <div class="overview-field">
                        <span class="overview-label">Valid Until</span>
                        <span class="overview-value">{formatDate(preclaimSet?.expiresAt)}</span>
                    </div>
                    <div class="overview-field overview-field-desc">
                        <span class="overview-label">Description</span>
                        <span class="overview-value">{preclaimSet?.description || '—'}</span>
                    </div>
                </div>
            </div>
        </Card>

        <div class="summary-cards">
            <div class="summary-card">
                <div class="summary-row">
                    <span class="summary-label">Total Devices</span>
                    <span class="summary-value">{totalDevices}</span>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-row">
                    <span class="summary-label">Devices Registered</span>
                    <span class="summary-value">{devicesRegistered}</span>
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-row">
                    <span class="summary-label">Devices Pending</span>
                    <span class="summary-value">{devicesPending}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Device Registered card (Frame 34) - full width, no header border -->
    <Card variant="default" padding="none" radius="2xl" showHeader={true} fullWidth={true} headerDivider={false}>
        <div slot="header" class="devices-header">
            <div class="devices-header-icon">
                <Monitor size={20} />
            </div>
            <div class="devices-header-text">
                <h3 class="overview-title">Device Registered</h3>
                <p class="overview-subtitle">Devices included in this pre-enrollment set.</p>
            </div>
        </div>
        <div class="devices-body">
            <!-- search & filter wrap: row, gap 16px, search left (max 500px), button right -->
            <div class="devices-toolbar">
                <div class="devices-toolbar-search">
                    <InputField
                        type="search"
                        placeholder="Search by Device name, MAC Address"
                        value={searchDisplayValue}
                        on:input={onSearchInput}
                        on:change={onSearchInput}
                    />
                </div>
                <div class="devices-toolbar-spacer" aria-hidden="true"></div>
                <input
                    type="file"
                    accept=".csv"
                    class="sr-only"
                    bind:this={importCsvInput}
                    on:change={onImportCsvFile}
                    aria-label="Select CSV file to import"
                />
                <Button
                    variant="outline"
                    color="primary"
                    size="md"
                    iconLeft={true}
                    disabled={importCsvSubmitting || !preclaimSet?.id}
                    on:click={() => importCsvInput?.click()}
                >
                    <Download size={20} slot="icon-left" />
                    {importCsvSubmitting ? 'Importing…' : 'Import CSV'}
                </Button>
            </div>
            <div class="devices-table-wrap">
                {#key `preclaim-devices-${preclaimSet?.id ?? ''}-${totalDevices}`}
                    <PreclaimDeviceTable preclaimId={preclaimSet?.id} hideToolbar={true} />
                {/key}
            </div>
        </div>
    </Card>
</div>

<AddEditPreclaimModal
    open={showEditModal}
    mode="edit"
    preclaimId={preclaimSet?.id ?? null}
    initialData={preclaimSet ? {
        name: preclaimSet.name,
        description: preclaimSet.description ?? undefined,
        status: preclaimSet.status ?? 'ACTIVE',
        expiresAt: preclaimSet.expiresAt ? new Date(preclaimSet.expiresAt).toISOString().slice(0, 10) : undefined,
        accountId: preclaimSet.accountId ?? preclaimSet.account?.id ?? undefined,
        profileId: preclaimSet.profileId ?? undefined
    } : null}
    profileOptions={profileOptionsList}
    accountOptions={accountOptionsList}
    on:close={() => (showEditModal = false)}
    on:success={() => {
        showEditModal = false;
        toast.success('Pre-Enrollment Set updated successfully!');
        goto($page.url.pathname, { invalidateAll: true });
    }}
    on:error={(e) => toast.error(e.detail || 'Unable to update Pre-Enrollment Set. Please try again!')}
/>

<style>
    /* main wrap: flex column, padding 24px, gap 16px (Figma) */
    .preclaim-detail {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 24px;
        gap: 16px;
        width: 100%;
    }
    /* buttons: align end */
    .detail-buttons {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        width: 100%;
    }
    /* Frame 50: overview + summary row, gap 16px */
    .detail-grid {
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 16px;
        width: 100%;
    }
    .detail-grid > :global(.ds-card) {
        flex: 1;
        min-width: 0;
    }
    .detail-grid > .summary-cards {
        flex: none;
    }
    @media (max-width: 768px) {
        .detail-grid {
            flex-direction: column;
        }
    }
    /* Overview card header: row, align center, padding 16px, border-bottom #E5E5E5 */
    .overview-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 16px;
        gap: 8px;
        border-bottom: 1px solid #E5E5E5;
        width: 100%;
    }
    .overview-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
    }
    .devices-header {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: var(--ds-card-padding-md);
        gap: 8px;
        border-bottom: 0;
        width: 100%;
    }
    .overview-header-icon,
    .devices-header-icon {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color: #A3A3A3;
        flex-shrink: 0;
    }
    .overview-header-icon:hover,
    .devices-header-icon:hover {
        background: var(--ds-color-neutral-true-100);
    }
    .overview-header-text,
    .devices-header-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    /* devices-body: flex column, padding 16px, gap 16px (Figma) */
    .devices-body {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 16px;
        gap: 16px;
        width: 100%;
        min-width: 0;
    }
    /* search & filter wrap: row, align center, gap 16px, search left 500px, button right */
    .devices-toolbar {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;
        width: 100%;
        min-width: 0;
    }
    .devices-toolbar-search {
        width: 500px;
        max-width: 100%;
        min-width: 0;
        flex: 0 1 500px;
    }
    .devices-toolbar-search :global(.ds-input-wrapper) {
        width: 100%;
    }
    .devices-toolbar-spacer {
        flex: 1;
        min-width: 16px;
    }
    /* table wrap: full width, design-system DataTable base */
    .devices-table-wrap {
        width: 100%;
        min-width: 0;
        overflow: hidden;
    }
    /* Body/18px/18-Medium, Neutral-True/900 #141414 */
    .overview-title {
        font-family: var(--ds-font-family-primary);
        font-weight: 500;
        font-size: 18px;
        line-height: 24px;
        color: #141414;
        margin: 0;
    }
    /* Body/14px/14-Regular, Gray/600 #475467 */
    .overview-subtitle {
        font-family: var(--ds-font-family-primary);
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #475467;
        margin: 0;
    }
    /* details wrap: padding 16px, gap 16px */
    .overview-body {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 16px;
        gap: 16px;
    }
    /* Grid: 4 columns, 2 rows. Row1: Name, Status, Assigned Account, Device Profile. Row2: Valid Until, Description (span 3) */
    .overview-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        width: 100%;
    }
    .overview-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }
    .overview-field-desc {
        grid-column: 2 / -1;
    }
    @media (max-width: 768px) {
        .overview-grid {
            grid-template-columns: 1fr;
        }
        .overview-field-desc {
            grid-column: 1;
        }
    }
    /* Status: display-only pill (listing), not a button – same look as Badge */
    .status-badge {
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 16px;
        font-family: var(--ds-font-family-primary);
        font-size: 14px;
        font-weight: 500;
        line-height: 20px;
        width: fit-content;
    }
    .status-badge-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .status-badge-success {
        background: #ECFDF3;
        color: #027A48;
    }
    .status-badge-success .status-badge-dot {
        background: #12B76A;
    }
    .status-badge-gray {
        background: #F2F4F7;
        color: #344054;
    }
    .status-badge-gray .status-badge-dot {
        background: #667085;
    }
    /* Label: Body/14px/14-Regular, Neutral-True/600 #525252 */
    .overview-label {
        font-size: 14px;
        font-weight: 400;
        line-height: 20px;
        color: #525252;
    }
    /* Value: Body/16px/16-Medium, Neutral-True/900 #141414 */
    .overview-value {
        font-size: 16px;
        font-weight: 500;
        line-height: 24px;
        color: #141414;
    }
    /* Device Profile link: Blue True/800 #0040C1 */
    .overview-link {
        font-size: 16px;
        font-weight: 500;
        line-height: 24px;
        color: #0040C1;
        text-decoration: none;
    }
    .overview-link:hover {
        text-decoration: underline;
    }
    /* Summary cards – Figma: wrap (summary-card) + Text Display (summary-row) */
    .summary-cards {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 315px;
        width: 315.5px;
    }
    /* wrap: flex column, padding 16px, gap 10px, 56px min-height, border-radius 12px */
    .summary-card {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 16px;
        gap: 10px;
        width: 100%;
        min-height: 56px;
        background: #FFFFFF;
        border: 1px solid #E5E5E5;
        border-radius: 12px;
        flex: none;
        align-self: stretch;
        flex-grow: 0;
    }
    /* Text Display: flex row, align center, gap 16px */
    .summary-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0;
        gap: 16px;
        width: 100%;
        min-width: 0;
        flex: none;
        align-self: stretch;
        flex-grow: 0;
    }
    /* Base/Sub-Title – Label: 14px regular, #525252 */
    .summary-label {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: 400;
        font-size: 14px;
        line-height: 20px;
        color: #525252;
        display: flex;
        align-items: center;
        flex: none;
    }
    /* Base – Value: flex 1, justify end; Body/16px/16-Medium, #141414, text-align right */
    .summary-value {
        font-family: var(--ds-font-family-primary);
        font-style: normal;
        font-weight: 500;
        font-size: 16px;
        line-height: 24px;
        color: #141414;
        text-align: right;
        margin-left: auto;
        flex: none;
    }
</style>
