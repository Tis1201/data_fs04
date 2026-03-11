<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { deserialize } from '$app/forms';
    import {
        Modal,
        InputField,
        Dropdown,
        TextareaField,
        Toggle,
        Button
    } from '$lib/design-system/components';
    import type { DropdownOption } from '$lib/design-system/components';
    import CharacterCount from '$lib/components/ui_components_sveltekit/form/CharacterCount.svelte';
    import { OS_OPTIONS } from '$lib/utils/bundleUtils';
    import { toast } from '$lib/stores/alertToast';
    import { DESCRIPTION_MAX, NAME_MAX } from '$lib/constants/description';

    const MAX_NAME_LENGTH = NAME_MAX;

    export let open = false;

    let submitting = false;

    const dispatch = createEventDispatcher<{
        close: void;
        created: { id: string };
    }>();

    // Form state
    let name = '';
    let os = '';
    let version = '1.0.0';
    let waveSize = 0;
    let schedule: '' | 'none' | 'future' = '';
    let startDate = '';
    let startTime = '09:00';
    let description = '';
    let reboot = false;
    let forceUpdate = false;

    // Validation
    let nameError = '';
    let osError = '';
    let batchSizeError = '';
    let scheduleError = '';
    let startDateError = '';

    function pad2(n: number): string {
        return String(n).padStart(2, '0');
    }

    function todayDateInputValue(now = new Date()): string {
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    }

    function nowTimeInputValue(now = new Date()): string {
        // Use current local time (minute precision) to prevent choosing past time today.
        return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    }

    $: minStartDate = todayDateInputValue();
    $: minStartTime = startDate === minStartDate ? nowTimeInputValue() : undefined;

    // Check if form is valid for enabling Save as Draft button
    $: isFormValid = name.trim().length > 0 && !!os && waveSize > 0 && !!schedule &&
        (schedule !== 'future' || !!startDate);

    const OS_OPTIONS_DS: DropdownOption[] = OS_OPTIONS.map((o) => ({ id: o.value, label: o.label }));
    const BATCH_PRESETS = [100, 200, 300, 400, 500];
    const BATCH_OPTIONS: DropdownOption[] = [
        ...BATCH_PRESETS.map((n) => ({ id: String(n), label: String(n) })),
        { id: 'custom', label: 'Custom' }
    ];
    let batchSizeSelect: string = '';
    const SCHEDULE_OPTIONS: DropdownOption[] = [
        { id: 'none', label: 'None' },
        { id: 'future', label: 'Future' }
    ];

    $: showScheduleFields = schedule === 'future';

    $: if (nameError && name.length > 0 && name.length <= MAX_NAME_LENGTH) {
        nameError = '';
    }

    $: if (schedule === 'none' || schedule === '') {
        startDate = '';
        startTime = '09:00';
        startDateError = '';
    }

    function validate(): boolean {
        nameError = '';
        osError = '';
        batchSizeError = '';
        scheduleError = '';
        startDateError = '';
        if (!name.trim()) {
            nameError = 'Name is required';
        } else if (name.length > MAX_NAME_LENGTH) {
            nameError = `Name must be ${MAX_NAME_LENGTH} characters or less`;
        }
        if (!os) {
            osError = 'Target OS is required';
        }
        if (!waveSize || waveSize <= 0) {
            batchSizeError = 'Batch Size is required';
        }
        if (!schedule) {
            scheduleError = 'Schedule is required';
        }
        if (schedule === 'future') {
            if (!startDate.trim()) startDateError = 'Start date is required';
            if (!startDateError && startDate) {
                const start = new Date(`${startDate}T${startTime || '00:00'}`);
                const now = new Date();
                if (isNaN(start.getTime())) {
                    startDateError = 'Invalid start date/time';
                } else if (start.getTime() < now.getTime()) {
                    startDateError = 'Start date/time cannot be in the past';
                }
            }
        }
        return !nameError && !osError && !batchSizeError && !scheduleError && !startDateError;
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
            // Match admin create behavior: use viewer timezone, server stores scheduledAt in UTC.
            fd.set('scheduledAtTimezone', Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        }
        // Keep backend behavior stable (schema+DB default is 1). Not user-configurable.
        fd.set('activePeriodDays', '1');
        return fd;
    }

    function closeModal() {
        dispatch('close');
    }

    async function submit() {
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
                toast.success('Deployment created successfully.');
                closeModal();
                dispatch('created', { id });
            } else {
                if (!responseText) {
                    responseText = await res.text();
                }
                try {
                    let data: { type?: string; data?: unknown } = {};
                    try {
                        data = JSON.parse(responseText);
                    } catch {
                        data = typeof responseText === 'string' && responseText.trim()
                            ? (deserialize(responseText) as { type?: string; data?: unknown })
                            : {};
                    }
                    const payload = data?.data;
                    let parsedPayload = typeof payload === 'object' ? payload : null;
                    if (payload && typeof payload === 'string') {
                        try {
                            parsedPayload = deserialize(payload) as Record<string, unknown>;
                        } catch {
                            // Ignore deserialize errors
                        }
                    }
                    const form = parsedPayload?.form as { errors?: Record<string, string[] | string> } | undefined;
                    if (form?.errors && typeof form.errors === 'object') {
                        const getErr = (key: string) => {
                            const v = form.errors![key];
                            return Array.isArray(v) ? v[0] : (typeof v === 'string' ? v : '');
                        };
                        nameError = getErr('name');
                        osError = getErr('os');
                        batchSizeError = getErr('waveSize');
                        const schedErr = getErr('scheduledAt') || getErr('scheduledTime');
                        if (schedErr) {
                            scheduleError = schedErr;
                            startDateError = schedErr;
                        }
                    }
                    const msg = form?.errors
                        ? (nameError || osError || batchSizeError || scheduleError)
                        : (data?.message || (data as any)?.error || (parsedPayload as any)?.form?.data?.message || 'Failed to create deployment.');
                    toast.error(msg || 'Failed to create deployment.');
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
        submit();
    }

    function handleCancel() {
        closeModal();
    }

    function handleScheduleChange(e: CustomEvent<string | string[]>) {
        const v = (Array.isArray(e.detail) ? e.detail[0] : e.detail) || '';
        schedule = v as '' | 'none' | 'future';
        if (scheduleError && schedule) scheduleError = '';
    }

    function handleOsChange(e: CustomEvent<string | string[]>) {
        os = Array.isArray(e.detail) ? e.detail[0] : e.detail || '';
        if (osError && os) osError = '';
    }

    function handleWaveSizeChange(e: CustomEvent<string | string[]>) {
        const val = Array.isArray(e.detail) ? e.detail[0] : e.detail || '';
        if (val === 'custom') {
            batchSizeSelect = 'custom';
            waveSize = 0;
        } else if (val) {
            batchSizeSelect = String(val);
            waveSize = parseInt(val, 10) || 0;
        }
        if (batchSizeError && waveSize > 0) batchSizeError = '';
    }

    function switchToPreset() {
        batchSizeSelect = '';
        waveSize = 0;
    }

    function handleCustomBatchSizeInput(e: Event) {
        const target = e.currentTarget as HTMLInputElement;
        waveSize = parseInt(target?.value || '0', 10) || 0;
    }

    function handleCustomBatchSizeBlur() {
        waveSize = Math.max(1, Math.min(999999, Math.floor(Number(waveSize)) || 1));
        if (batchSizeError && waveSize > 0) batchSizeError = '';
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
            <Button type="button" variant="outline" size="lg" color="primary" on:click={handleSaveDraft} loading={submitting} disabled={submitting || !isFormValid}>Save as Draft</Button>
        </div>
    </svelte:fragment>
    <form class="add-deployment-form" on:submit|preventDefault={() => submit()}>
        <div class="form-grid">
            <div class="col-left">
                <div class="field-wrap">
                    <InputField
                        type="text"
                        label="Deployment Name"
                        placeholder="Enter"
                        bind:value={name}
                        required={true}
                        maxlength={MAX_NAME_LENGTH}
                        state={nameError ? 'error' : 'default'}
                        helperText={nameError}
                    />
                    <CharacterCount current={name.length} max={MAX_NAME_LENGTH} />
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
                                value={waveSize ? String(waveSize) : ''}
                                on:input={handleCustomBatchSizeInput}
                                on:blur={handleCustomBatchSizeBlur}
                                required={true}
                                state={batchSizeError ? 'error' : 'default'}
                                helperText={batchSizeError}
                            />
                            <button type="button" class="batch-size-preset-link" on:click={switchToPreset}>Use preset</button>
                        {:else}
                            <Dropdown
                                label="Batch Size"
                                placeholder="Select"
                                options={BATCH_OPTIONS}
                                value={batchSizeSelect}
                                required={true}
                                error={!!batchSizeError}
                                errorMessage={batchSizeError}
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
                        error={!!osError}
                        errorMessage={osError}
                        on:change={handleOsChange}
                    />
                    <p class="field-spacer" aria-hidden="true">&nbsp;</p>
                </div>
                <div class="field-wrap">
                    <Dropdown
                        label="Schedule"
                        placeholder="Select"
                        options={SCHEDULE_OPTIONS}
                        value={schedule}
                        required={true}
                        error={!!scheduleError}
                        errorMessage={scheduleError}
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
                                min={minStartDate}
                                state={startDateError ? 'error' : 'default'}
                                placeholder="MM DD, YYYY"
                                label=""
                            />
                            <InputField
                                type="time"
                                bind:value={startTime}
                                min={minStartTime}
                                state={startDateError ? 'error' : 'default'}
                                label=""
                            />
                        </div>
                        {#if startDateError}
                            <p class="field-error">{startDateError}</p>
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
                    maxlength={DESCRIPTION_MAX}
                />
                <CharacterCount current={description.length} max={DESCRIPTION_MAX} />
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
    /* Hidden row to align Target to Operating System height with Deployment Name (which has char count) */
    .field-spacer {
        margin: 4px 0 0;
        font-size: var(--ds-text-xs);
        line-height: var(--ds-leading-xs);
        min-height: 20px;
        visibility: hidden;
        pointer-events: none;
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
