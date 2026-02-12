<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import {
        Modal,
        InputField,
        Dropdown,
        TextareaField,
        Toggle,
        Button
    } from '$lib/design-system/components';
    import type { DropdownOption } from '$lib/design-system/components';
    import { OS_OPTIONS } from '$lib/utils/bundleUtils';
    import { toast } from '$lib/stores/alertToast';
    import type { Bundle } from '@prisma/client';

    export let open = false;
    /** Bundle to edit (from list). Must be DRAFT to be editable. */
    export let bundle: Bundle | null = null;

    let submitting = false;

    // Guard: bundle prop can change (realtime/invalidate) while modal is open.
    // We only want to initialize form state once per open (or when editing a different bundle id),
    // otherwise user interactions (Schedule=Future, Batch Size=Custom, etc.) get overwritten.
    let didInitFromBundle = false;
    let initBundleId: string | null = null;

    const dispatch = createEventDispatcher<{
        close: void;
        saved: { id: string };
    }>();

    // Form state (same as Add)
    let name = '';
    let os = 'ANDROID';
    let version = '1.0.0';
    let waveSize = 500;
    let schedule: 'none' | 'future' = 'none';
    let startDate = '';
    let startTime = '09:00';
    // Preserve existing active period (not user-configurable in this modal)
    let activePeriodDays = 1;
    let description = '';
    let reboot = false;
    let forceUpdate = false;

    let nameError = '';
    let startDateError = '';

    function pad2(n: number): string {
        return String(n).padStart(2, '0');
    }

    function todayDateInputValue(now = new Date()): string {
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    }

    function nowTimeInputValue(now = new Date()): string {
        return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    }

    $: minStartDate = todayDateInputValue();
    $: minStartTime = startDate === minStartDate ? nowTimeInputValue() : undefined;

    $: isFormValid = name.trim().length > 0 && os && waveSize > 0 &&
        (schedule !== 'future' || !!startDate);

    const OS_OPTIONS_DS: DropdownOption[] = OS_OPTIONS.map((o) => ({ id: o.value, label: o.label }));
    const BATCH_PRESETS = [100, 200, 300, 400, 500];
    const BATCH_OPTIONS: DropdownOption[] = [
        ...BATCH_PRESETS.map((n) => ({ id: String(n), label: String(n) })),
        { id: 'custom', label: 'Custom' }
    ];
    let batchSizeSelect: string = '500';
    const SCHEDULE_OPTIONS: DropdownOption[] = [
        { id: 'none', label: 'None' },
        // { id: 'immediately', label: 'Immediately' },
        { id: 'future', label: 'Future' }
    ];

    $: showScheduleFields = schedule === 'future';

    function formatDateForInput(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatTimeForInput(d: Date): string {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    // Reset init guard when modal closes
    $: if (!open) {
        didInitFromBundle = false;
        initBundleId = null;
    }

    /** Initialize form from bundle on open (one-shot) */
    $: if (open && bundle && (!didInitFromBundle || initBundleId !== bundle.id)) {
        name = bundle.name || '';
        description = bundle.description || '';
        os = bundle.os || 'ANDROID';
        version = bundle.version || '1.0.0';
        waveSize = Number(bundle.waveSize) || 500;
        batchSizeSelect = BATCH_PRESETS.includes(waveSize) ? String(waveSize) : 'custom';
        reboot = !!bundle.reboot;
        forceUpdate = !!(bundle as any).forceUpdate;

        const scheduledAt = bundle.scheduledAt ? new Date(bundle.scheduledAt) : null;
        activePeriodDays = Math.min(Math.max((bundle as any).activePeriodDays ?? 1, 1), 30);

        if (scheduledAt && !isNaN(scheduledAt.getTime())) {
            schedule = 'future';
            startDate = formatDateForInput(scheduledAt);
            startTime = formatTimeForInput(scheduledAt);
        } else {
            schedule = 'none';
            startDate = '';
            startTime = '09:00';
        }
        nameError = '';
        startDateError = '';

        didInitFromBundle = true;
        initBundleId = bundle.id;
    }

    $: if (schedule === 'none') {
        startDate = '';
        startTime = '09:00';
        startDateError = '';
    }

    function validate(): boolean {
        nameError = '';
        startDateError = '';
        if (!name.trim()) nameError = 'Name is required';
        if (schedule === 'future' && !startDate.trim()) {
            startDateError = 'Start date is required';
        }
        if (!startDateError && schedule === 'future' && startDate) {
            const start = new Date(`${startDate}T${startTime || '00:00'}`);
            const now = new Date();
            if (isNaN(start.getTime())) {
                startDateError = 'Invalid start date/time';
            } else if (start.getTime() < now.getTime()) {
                startDateError = 'Start date/time cannot be in the past';
            }
        }
        return !nameError && !startDateError;
    }

    function buildFormData(): FormData {
        const fd = new FormData();
        fd.set('name', name.trim());
        fd.set('description', description.trim());
        fd.set('os', os);
        fd.set('version', version.trim() || '1.0.0');
        fd.set('waveSize', String(waveSize));
        fd.set('reboot', reboot ? 'on' : '');
        fd.set('forceUpdate', forceUpdate ? 'on' : '');
        fd.set('autoOpen', '');
        fd.set('scheduledAtStartIfMissed', '');
        if (schedule === 'future' && startDate) {
            fd.set('scheduledAt', startDate);
            fd.set('scheduledTime', startTime || '09:00');
            fd.set('scheduledAtTimezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        }
        // Preserve existing active period (backend uses this for timeouts/late events)
        fd.set('activePeriodDays', String(activePeriodDays));
        return fd;
    }

    function closeModal() {
        dispatch('close');
    }

    async function submit() {
        if (!bundle || !validate()) return;
        submitting = true;
        const fd = buildFormData();
        try {
            const res = await fetch(`/user/iot/bundles/${bundle.id}/edit?/save`, {
                method: 'POST',
                body: fd,
                redirect: 'manual',
                credentials: 'same-origin'
            });

            let location = res.headers.get('Location');
            let responseText = await res.text();
            let isRedirect = res.status >= 300 && res.status < 400;

            if (responseText) {
                try {
                    const body = JSON.parse(responseText) as { type?: string; status?: number; location?: string };
                    if (body.type === 'redirect' || body.status === 303) {
                        isRedirect = true;
                        location = body.location ?? location ?? '';
                    }
                } catch {
                    // not JSON
                }
            }

            if (isRedirect && location && location.includes(`/user/iot/bundles/${bundle.id}`)) {
                toast.success('Deployment updated successfully.');
                closeModal();
                dispatch('saved', { id: bundle.id });
            } else {
                try {
                    const data = responseText ? JSON.parse(responseText) : {};
                    const msg = data?.error || data?.form?.data?.message || 'Failed to update deployment.';
                    toast.error(msg);
                } catch {
                    toast.error('Failed to update deployment. Please try again.');
                }
            }
        } catch (e) {
            toast.error('Failed to update deployment. Please try again.');
        } finally {
            submitting = false;
        }
    }

    function handleCancel() {
        closeModal();
    }

    function handleScheduleChange(e: CustomEvent<string | string[]>) {
        const v = (Array.isArray(e.detail) ? e.detail[0] : e.detail) || 'none';
        schedule = v as 'none' | 'future';
    }

    function handleOsChange(e: CustomEvent<string | string[]>) {
        os = Array.isArray(e.detail) ? e.detail[0] : e.detail || 'ANDROID';
    }

    function handleWaveSizeChange(e: CustomEvent<string | string[]>) {
        const val = Array.isArray(e.detail) ? e.detail[0] : e.detail || '500';
        if (val === 'custom') {
            batchSizeSelect = 'custom';
        } else {
            batchSizeSelect = String(val);
            waveSize = parseInt(val, 10) || 500;
        }
    }

    function switchToPreset() {
        batchSizeSelect = '500';
        waveSize = 500;
    }

    function handleCustomBatchSizeBlur() {
        waveSize = Math.max(1, Math.min(999999, Math.floor(Number(waveSize)) || 1));
    }
</script>

<Modal
    {open}
    title="Edit Deployment"
    type="default"
    size="lg"
    showFooter={true}
    showCancel={false}
    showTextButton={false}
    on:close={closeModal}
>
    <svelte:fragment slot="footer">
        <div class="modal-footer-actions">
            <Button type="button" variant="outline" size="lg" color="primary" on:click={handleCancel}>Cancel</Button>
            <Button type="button" variant="filled" size="lg" color="primary" on:click={submit} loading={submitting} disabled={submitting || !isFormValid}>Save Changes</Button>
        </div>
    </svelte:fragment>
    <form class="add-deployment-form" on:submit|preventDefault={submit}>
        <div class="form-grid">
            <div class="col-left">
                <div class="field-wrap">
                    <InputField
                        type="text"
                        label="Deployment Name"
                        placeholder="Enter"
                        bind:value={name}
                        required={true}
                        state={nameError ? 'error' : 'default'}
                        helperText={nameError}
                    />
                </div>
                <div class="row-version-batch">
                    <div class="field-wrap version-field">
                        <InputField
                            type="text"
                            label="Version"
                            placeholder="Enter"
                            bind:value={version}
                        />
                    </div>
                    <div class="field-wrap batch-size-field">
                        {#if batchSizeSelect === 'custom'}
                            <InputField
                                type="number"
                                label="Batch Size"
                                placeholder="Enter number"
                                min={1}
                                bind:value={waveSize}
                                on:blur={handleCustomBatchSizeBlur}
                                required={true}
                            />
                            <button type="button" class="batch-size-preset-link" on:click={switchToPreset}>Use preset</button>
                        {:else}
                            <Dropdown
                                label="Batch Size"
                                placeholder="Select"
                                options={BATCH_OPTIONS}
                                value={batchSizeSelect}
                                required={true}
                                on:change={handleWaveSizeChange}
                            />
                        {/if}
                    </div>
                </div>
            </div>
            <div class="col-right">
                <div class="field-wrap">
                    <Dropdown
                        label="Target to Operating System"
                        placeholder="Select"
                        options={OS_OPTIONS_DS}
                        value={os}
                        required={true}
                        on:change={handleOsChange}
                    />
                </div>
                <div class="field-wrap">
                    <Dropdown
                        label="Schedule"
                        placeholder="Select"
                        options={SCHEDULE_OPTIONS}
                        value={schedule}
                        required={true}
                        on:change={handleScheduleChange}
                    />
                </div>
            </div>
            {#if showScheduleFields}
                <div class="field-schedule-row">
                    <div class="field-schedule-group">
                        <span class="field-label required" id="edit-start-datetime-label">Start on Date & Time</span>
                        <div class="date-time-row" role="group" aria-labelledby="edit-start-datetime-label">
                            <InputField type="date" bind:value={startDate} min={minStartDate} state={startDateError ? 'error' : 'default'} placeholder="MM DD, YYYY" label="" />
                            <InputField type="time" bind:value={startTime} min={minStartTime} state={startDateError ? 'error' : 'default'} label="" />
                        </div>
                        {#if startDateError}<p class="field-error">{startDateError}</p>{/if}
                    </div>
                </div>
            {/if}
            <div class="field-full">
                <TextareaField label="Description" placeholder="Enter" bind:value={description} rows={3} />
            </div>
        </div>
        <div class="device-behavior-section">
            <h3 class="section-title">Device Behavior</h3>
            <div class="toggle-card">
                <Toggle size="sm" label="Reboot Device" supportingText="Reboot device(s) after installation" labelPosition="left" bind:checked={reboot} />
            </div>
            <div class="toggle-card">
                <Toggle size="sm" label="Force Update" supportingText="Force to update device(s)" labelPosition="left" bind:checked={forceUpdate} />
            </div>
        </div>
    </form>
</Modal>

<style>
    .add-deployment-form {
        font-family: var(--ds-font-family-primary);
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        --form-col-gap: var(--ds-space-4);
    }
    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--form-col-gap);
        width: 100%;
        min-width: 0;
        align-items: start;
    }
    .col-left, .col-right {
        display: flex;
        flex-direction: column;
        gap: var(--form-col-gap);
        min-width: 0;
    }
    /* Version + Batch Size row: align at top so "Use preset" under Batch Size doesn't make Version look off */
    .row-version-batch {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--form-col-gap);
        width: 100%;
        min-width: 0;
        align-items: start;
    }
    .row-version-batch .field-wrap { min-width: 0; }
    /* Version: plain text input (no dropdown-like min-height) */
    .row-version-batch .field-wrap.version-field > :global(.input-field-wrapper) {
        min-height: auto;
    }
    .batch-size-preset-link {
        margin-top: 4px;
        padding: 0;
        font-size: 12px;
        color: var(--ds-text-link, #2563eb);
        background: none;
        border: none;
        cursor: pointer;
        text-decoration: underline;
    }
    .batch-size-preset-link:hover {
        color: var(--ds-text-link-hover, #1d4ed8);
    }
    .row-version-batch .field-wrap > :global(.input-field-wrapper),
    .row-version-batch .field-wrap > :global(.dropdown-container) { width: 100%; }
    .field-wrap { min-width: 0; }
    .field-wrap > :global(.input-field-wrapper),
    .field-wrap > :global(.dropdown-container) {
        min-height: 76px;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: 100%;
    }
    .field-wrap > :global(.dropdown-container) :global(.dropdown-label) {
        padding: 2px;
        box-sizing: border-box;
    }
    .field-full { grid-column: 1 / -1; }
    .field-schedule-row {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--form-col-gap);
        width: 100%;
        min-width: 0;
        align-items: start;
    }
    .field-schedule-group {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        min-width: 0;
        min-height: 76px;
        box-sizing: border-box;
    }
    .field-label {
        font-size: var(--ds-text-sm);
        font-weight: var(--ds-font-medium);
        color: var(--ds-text-primary);
        padding: 2px 0;
        box-sizing: border-box;
    }
    .field-label.required::after {
        content: ' *';
        color: var(--ds-color-error-500);
    }
    .date-time-row {
        display: flex;
        gap: var(--ds-space-2);
        width: 100%;
        min-width: 0;
    }
    .date-time-row > :global(div) { flex: 1 1 0; min-width: 0; }
    .date-time-row :global(.input-field-wrapper),
    .date-time-row :global(.input-container) { width: 100%; min-width: 0; box-sizing: border-box; }
    .field-error { margin: 0; font-size: var(--ds-text-xs); color: var(--ds-color-error-600); }
    .device-behavior-section {
        margin-top: var(--ds-space-6);
        padding-top: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-default);
        width: 100%;
    }
    .section-title {
        font-size: var(--ds-text-base);
        font-weight: var(--ds-font-semibold);
        color: var(--ds-text-primary);
        margin: 0 0 var(--ds-space-3) 0;
    }
    .toggle-card {
        background: var(--ds-color-neutral-true-50, #FAFAFA);
        border-radius: 8px;
        padding: 8px 16px;
        min-height: 56px;
        display: flex;
        align-items: center;
        margin-bottom: var(--ds-space-3);
        width: 100%;
        box-sizing: border-box;
    }
    .toggle-card :global(> *) { width: 100%; justify-content: space-between; }
    .toggle-card:last-child { margin-bottom: 0; }
    .modal-footer-actions {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: var(--ds-space-3);
        width: 100%;
    }
    @media (max-width: 768px) {
        .form-grid { grid-template-columns: 1fr; }
        .row-version-batch { grid-template-columns: 1fr; }
        .field-schedule-row { grid-template-columns: 1fr; }
        .date-time-row { flex-direction: column; }
    }
    @media (max-width: 600px) {
        .modal-footer-actions { flex-direction: column-reverse; gap: var(--ds-space-2); }
        .modal-footer-actions :global(button) { width: 100%; }
    }
</style>
