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

    export let open = false;

    let submitting = false;

    const dispatch = createEventDispatcher<{
        close: void;
        created: { id: string; publish: boolean };
    }>();

    // Form state
    let name = '';
    let os = 'ANDROID';
    let version = '1.0.0';
    let waveSize = 500;
    let schedule: 'none' | 'immediately' | 'future' = 'none';
    let startDate = '';
    let startTime = '09:00';
    let endDate = '';
    let endTime = '21:00';
    let description = '';
    let reboot = false;
    let forceUpdate = false;

    // Validation
    let nameError = '';
    let startDateError = '';
    let endDateError = '';

    // Publish confirmation modal
    let showPublishConfirm = false;
    let pendingBundleId = '';

    // Check if form is valid for enabling Publish button
    $: isFormValid = name.trim().length > 0 && os && waveSize > 0 && 
        (!showScheduleFields || (startDate && endDate));

    const OS_OPTIONS_DS: DropdownOption[] = OS_OPTIONS.map((o) => ({ id: o.value, label: o.label }));
    const BATCH_PRESETS = [100, 200, 300, 400, 500];
    const BATCH_OPTIONS: DropdownOption[] = [
        ...BATCH_PRESETS.map((n) => ({ id: String(n), label: String(n) })),
        { id: 'custom', label: 'Custom' }
    ];
    let batchSizeSelect: string = '500';
    const SCHEDULE_OPTIONS: DropdownOption[] = [
        { id: 'none', label: 'None' },
        { id: 'immediately', label: 'Immediately' },
        { id: 'future', label: 'Future' }
    ];

    $: showScheduleFields = schedule === 'immediately' || schedule === 'future';

    function fillImmediatelyDefaults() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        startDate = formatDateForInput(today);
        startTime = '09:00';
        endDate = formatDateForInput(tomorrow);
        endTime = '21:00';
        startDateError = '';
        endDateError = '';
    }

    function formatDateForInput(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    $: if (open && schedule === 'immediately' && !startDate) {
        fillImmediatelyDefaults();
    }

    $: if (schedule === 'none') {
        startDate = '';
        startTime = '09:00';
        endDate = '';
        endTime = '21:00';
        startDateError = '';
        endDateError = '';
    }

    function validate(): boolean {
        nameError = '';
        startDateError = '';
        endDateError = '';
        if (!name.trim()) {
            nameError = 'Name is required';
        }
        if (showScheduleFields) {
            if (!startDate.trim()) {
                startDateError = 'Start date is required';
            }
            if (!endDate.trim()) {
                endDateError = 'End date is required';
            }
            if (startDate && endDate && startTime && endTime) {
                const start = new Date(startDate + 'T' + startTime);
                const end = new Date(endDate + 'T' + endTime);
                if (start >= end) {
                    startDateError = 'Start Date must before End Date';
                    endDateError = 'End Date must after Start Date';
                }
            }
        }
        return !nameError && !startDateError && !endDateError;
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
        if (showScheduleFields && startDate) {
            fd.set('scheduledAt', startDate);
            fd.set('scheduledTime', startTime || '09:00');
            fd.set('scheduledAtTimezone', 'UTC');
            const end = new Date(endDate + 'T' + (endTime || '00:00'));
            const start = new Date(startDate + 'T' + (startTime || '00:00'));
            const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
            fd.set('activePeriodDays', String(Math.min(days, 30)));
        } else {
            fd.set('activePeriodDays', '1');
        }
        return fd;
    }

    function closeModal() {
        dispatch('close');
    }

    async function submit(publishAfterCreate: boolean) {
        if (!validate()) return;
        submitting = true;
        const fd = buildFormData();
        try {
            const res = await fetch('/user/iot/bundles/new?/create', {
                method: 'POST',
                body: fd,
                redirect: 'manual',
                credentials: 'same-origin'
            });

            // SvelteKit form actions return HTTP 200 with JSON body {type: "redirect", status: 303, location: "..."}
            // OR actual HTTP 303 with Location header
            let location = res.headers.get('Location');
            let responseText = '';
            let isRedirect = res.status >= 300 && res.status < 400;

            // Always read body for form action responses
            responseText = await res.text();
            if (responseText) {
                try {
                    const body = JSON.parse(responseText) as { type?: string; status?: number; location?: string; Location?: string };
                    // SvelteKit redirect format: {type: "redirect", status: 303, location: "/..."}
                    if (body.type === 'redirect' || body.status === 303) {
                        isRedirect = true;
                        location = body.location ?? body.Location ?? location ?? '';
                    } else if (!location && (body.location || body.Location)) {
                        location = body.location ?? body.Location ?? '';
                    }
                } catch {
                    // Not JSON, ignore
                }
            }

            const id = location?.match(/\/user\/iot\/bundles\/([^/?#]+)/)?.[1];

            if (isRedirect && id) {
                if (publishAfterCreate) {
                    const pubRes = await fetch(`/api/v2/bundles/${id}/publish`, {
                        method: 'POST',
                        credentials: 'same-origin'
                    });
                    const pubJson = await pubRes.json().catch(() => ({}));
                    if (pubRes.ok && pubJson.success) {
                        toast.success('Deployment published successfully!');
                    } else {
                        toast.error(pubJson.message || 'Unable to publish Deployment. Please try again!');
                    }
                } else {
                    toast.success('Deployment created successfully.');
                }
                closeModal();
                dispatch('created', { id, publish: publishAfterCreate });
            } else {
                if (!responseText) {
                    responseText = await res.text();
                }
                try {
                    const data = JSON.parse(responseText);
                    const msg = data?.message || data?.error || data?.form?.data?.message || 'Failed to create deployment.';
                    toast.error(msg);
                } catch {
                    toast.error('Failed to create deployment. Please try again.');
                }
            }
        } catch (e) {
            toast.error('Failed to create deployment. Please try again.');
        } finally {
            submitting = false;
        }
    }

    function handleSaveDraft() {
        submit(false);
    }

    function handlePublishClick() {
        if (!validate()) return;
        showPublishConfirm = true;
    }

    function handlePublishConfirm() {
        showPublishConfirm = false;
        submit(true);
    }

    function handlePublishCancel() {
        showPublishConfirm = false;
    }

    function handleCancel() {
        closeModal();
    }

    function handleScheduleChange(e: CustomEvent<string | string[]>) {
        const v = (Array.isArray(e.detail) ? e.detail[0] : e.detail) || 'none';
        schedule = v as 'none' | 'immediately' | 'future';
        if (schedule === 'immediately') {
            fillImmediatelyDefaults();
        }
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
    title="Add Deployment"
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
            <Button type="button" variant="outline" size="lg" color="primary" on:click={handleSaveDraft} disabled={submitting || !isFormValid}>Save as Draft</Button>
            <Button type="button" variant="filled" size="lg" color="primary" on:click={handlePublishClick} loading={submitting} disabled={submitting || !isFormValid}>Publish</Button>
        </div>
    </svelte:fragment>
    <form class="add-deployment-form" on:submit|preventDefault={() => submit(false)}>
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
                        <span class="field-label required" id="start-datetime-label">Start on Date & Time</span>
                        <div class="date-time-row" role="group" aria-labelledby="start-datetime-label">
                            <InputField
                                type="date"
                                bind:value={startDate}
                                state={startDateError ? 'error' : 'default'}
                                placeholder="MM DD, YYYY"
                                label=""
                            />
                            <InputField
                                type="time"
                                bind:value={startTime}
                                state={startDateError ? 'error' : 'default'}
                                label=""
                            />
                        </div>
                        {#if startDateError}
                            <p class="field-error">{startDateError}</p>
                        {/if}
                    </div>
                    <div class="field-schedule-group">
                        <span class="field-label required" id="end-datetime-label">End on Date & Time</span>
                        <div class="date-time-row" role="group" aria-labelledby="end-datetime-label">
                            <InputField
                                type="date"
                                bind:value={endDate}
                                state={endDateError ? 'error' : 'default'}
                                placeholder="MM DD, YYYY"
                                label=""
                            />
                            <InputField
                                type="time"
                                bind:value={endTime}
                                state={endDateError ? 'error' : 'default'}
                                label=""
                            />
                        </div>
                        {#if endDateError}
                            <p class="field-error">{endDateError}</p>
                        {/if}
                    </div>
                </div>
            {/if}
            <div class="field-full">
                <TextareaField
                    label="Description"
                    placeholder="Enter"
                    bind:value={description}
                    rows={3}
                />
            </div>
        </div>

        <div class="device-behavior-section">
            <h3 class="section-title">Device Behavior</h3>
            <div class="toggle-card">
                <Toggle
                    size="sm"
                    label="Reboot Device"
                    supportingText="Reboot device(s) after installation"
                    labelPosition="left"
                    bind:checked={reboot}
                />
            </div>
            <div class="toggle-card">
                <Toggle
                    size="sm"
                    label="Force Update"
                    supportingText="Force to update device(s)"
                    labelPosition="left"
                    bind:checked={forceUpdate}
                />
            </div>
        </div>
    </form>
</Modal>

<!-- Publish Confirmation Modal (same as listing action menu) -->
<Modal
    open={showPublishConfirm}
    title="Deployment Confirm"
    type="warning"
    size="md"
    showFooter={true}
    confirmText="Confirm"
    cancelText="Cancel"
    on:close={handlePublishCancel}
    on:confirm={handlePublishConfirm}
    on:cancel={handlePublishCancel}
>
    <p class="publish-confirm-text">Are you sure you want to create this deployment?</p>
    <p class="publish-confirm-desc">This action will trigger the deployment automatically based on the scheduled date & time. If no schedule is configured, the deployment will require manual execution.</p>
</Modal>

<style>
    /* Single gap variable so Version/Batch Size and Start/End Date & Time use the exact same spacing */
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
    .col-left,
    .col-right {
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
    .row-version-batch .field-wrap {
        min-width: 0;
    }
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
    .row-version-batch .field-wrap > :global(.dropdown-container) {
        width: 100%;
    }
    .field-wrap {
        min-width: 0;
    }
    .field-wrap > :global(.input-field-wrapper),
    .field-wrap > :global(.dropdown-container) {
        min-height: 76px;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        width: 100%;
    }
    /* Match InputField label row height (padding 2px) so Deployment Name and Target OS align */
    .field-wrap > :global(.dropdown-container) :global(.dropdown-label) {
        padding: 2px;
        box-sizing: border-box;
    }
    .field-full {
        grid-column: 1 / -1;
    }
    /* Schedule row: same 2-column grid and exact same gap as Version/Batch Size */
    .field-schedule-row {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: 1fr 1fr;
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
    /* Date & Time row: equal width for date and time inputs */
    .date-time-row {
        display: flex;
        gap: var(--ds-space-2);
        width: 100%;
        min-width: 0;
    }
    .date-time-row > :global(div) {
        flex: 1 1 0;
        min-width: 0;
    }
    .date-time-row :global(.input-field-wrapper) {
        width: 100%;
        min-width: 0;
    }
    .date-time-row :global(.input-container) {
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
    }
    .field-error {
        margin: 0;
        font-size: var(--ds-text-xs);
        color: var(--ds-color-error-600);
    }
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
    /* Figma: Toggle base 848 Fill x 56 Hug, Radius 8px, Padding 8px 16px, Neutral True/50 #FAFAFA */
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
    .toggle-card :global(> *) {
        width: 100%;
        justify-content: space-between;
    }
    .toggle-card:last-child {
        margin-bottom: 0;
    }
    .modal-footer-actions {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: var(--ds-space-3);
        width: 100%;
    }
    .publish-confirm-text {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-primary);
        margin: 0 0 var(--ds-space-2) 0;
    }
    .publish-confirm-desc {
        font-family: var(--ds-font-family-primary);
        font-size: var(--ds-text-sm);
        line-height: var(--ds-leading-sm);
        color: var(--ds-text-secondary);
        margin: 0;
    }

    /* Responsive: stack to 1 column on smaller screens */
    @media (max-width: 768px) {
        .form-grid {
            grid-template-columns: 1fr;
        }
        .row-version-batch {
            grid-template-columns: 1fr;
        }
        .field-schedule-row {
            grid-template-columns: 1fr;
        }
        .date-time-row {
            flex-direction: column;
        }
    }

    /* Responsive: stack footer buttons on small screens */
    @media (max-width: 600px) {
        .modal-footer-actions {
            flex-direction: column-reverse;
            gap: var(--ds-space-2);
        }
        .modal-footer-actions :global(button) {
            width: 100%;
        }
    }
</style>
